#!/usr/bin/env python3
"""Collect review-only MusicBrainz candidates from explicit mappings; never edit catalog.
Python 3 standard library only. See COLLECTOR.md for usage.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = 'https://musicbrainz.org/ws/2/'
INCLUDES = {
    'artist': 'aliases+url-rels',
    'release-group': 'artist-credits+url-rels',
    'release': 'recordings+artist-credits+labels+url-rels',
}

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def encoded_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')

def digest(value):
    return hashlib.sha256(encoded_json(value)).hexdigest()

def make_url(kind, mbid):
    return ROOT + kind + '/' + mbid + '?' + urllib.parse.urlencode({'inc': INCLUDES[kind], 'fmt': 'json'})

def parse_mapping(value):
    try:
        entity_id, raw = value.split('=', 1)
        mbid = str(uuid.UUID(raw))
        if not entity_id.strip() or raw.lower() != mbid:
            raise ValueError()
        return entity_id, mbid
    except ValueError:
        raise argparse.ArgumentTypeError('Expected nonempty ENTITY_ID=canonical-MBID-UUID: ' + value)

def load_catalog(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    entities = data.get('nodes', data.get('entities')) if isinstance(data, dict) else data
    if isinstance(entities, dict):
        entities = [dict(v, id=k) if 'id' not in v else v for k, v in entities.items()]
    if not isinstance(entities, list) or not all(isinstance(n, dict) and isinstance(n.get('id'), str) for n in entities):
        raise ValueError('Catalog must be an entity list, or contain nodes/entities with string id fields')
    ids = [n['id'] for n in entities]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate catalog entity IDs')
    return {n['id']: n for n in entities}

def service_link(url):
    """Validate syntax only, never assert that a URL is live or musically correct."""
    if not isinstance(url, str):
        return None
    try:
        p = urllib.parse.urlsplit(url)
        if p.scheme not in ('http', 'https') or p.username or p.password or p.port not in (None, 80, 443):
            return None
    except ValueError:
        return None
    host = (p.hostname or '').lower()
    if host == 'open.spotify.com':
        match = re.fullmatch(r'/(?:intl-[a-z]{2}/)?(artist|album|track)/([A-Za-z0-9]{22})/?', p.path)
        if match:
            kind, identifier = match.groups()
            return {'service': 'spotify', 'resourceType': kind, 'externalId': identifier,
                    'url': 'https://open.spotify.com/' + kind + '/' + identifier}
    elif host in ('www.youtube.com', 'youtube.com', 'music.youtube.com', 'youtu.be'):
        identifier = None
        if host == 'youtu.be':
            identifier = p.path.strip('/')
        elif p.path == '/watch':
            values = urllib.parse.parse_qs(p.query).get('v', [])
            if len(values) == 1:
                identifier = values[0]
        else:
            match = re.fullmatch(r'/(?:shorts|embed)/([A-Za-z0-9_-]{11})/?', p.path)
            if match:
                identifier = match[1]
        if identifier and re.fullmatch(r'[A-Za-z0-9_-]{11}', identifier):
            return {'service': 'youtube', 'resourceType': 'video', 'externalId': identifier,
                    'url': 'https://www.youtube.com/watch?v=' + identifier}
    return None

def links(payload):
    result, seen = [], set()
    for relation in payload.get('relations', []):
        raw = relation.get('url', {}).get('resource')
        link = service_link(raw)
        if link and link['url'] not in seen:
            seen.add(link['url'])
            link.update(status='candidate', reviewStatus='pending_reviewer',
                        matchMethod='explicit-mbid-url-relationship', sourceUrl=raw,
                        relationType=relation.get('type'), relationTypeId=relation.get('type-id'),
                        validation='hostname-and-resource-syntax-only',
                        officialUploaderVerified=False, availabilityVerified=False)
            result.append(link)
    return result

def select(payload, fields):
    return {field: payload[field] for field in fields if field in payload}

def extract(kind, payload):
    if kind == 'artist':
        return select(payload, ['id', 'name', 'sort-name', 'type', 'aliases', 'life-span', 'area',
                                'begin-area', 'end-area', 'country', 'disambiguation'])
    if kind == 'release-group':
        return select(payload, ['id', 'title', 'disambiguation', 'first-release-date',
                                'primary-type', 'secondary-types', 'artist-credit'])
    result = select(payload, ['id', 'title', 'disambiguation', 'date', 'country', 'status',
                              'barcode', 'packaging', 'text-representation', 'artist-credit',
                              'label-info', 'release-events', 'release-group'])
    result['media'] = []
    for medium in payload.get('media', []):
        entry = select(medium, ['position', 'title', 'format', 'track-count'])
        entry['tracks'] = []
        for track in medium.get('tracks', []):
            t = select(track, ['id', 'position', 'number', 'title', 'length', 'artist-credit'])
            recording = track.get('recording')
            if isinstance(recording, dict):
                t['recording'] = select(recording, ['id', 'title', 'length', 'disambiguation',
                                                    'video', 'artist-credit', 'isrcs'])
            entry['tracks'].append(t)
        result['media'].append(entry)
    return result

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def open_no_redirect(request, timeout):
    # A merged MBID must be reviewed, not followed with an unthrottled implicit request.
    return urllib.request.build_opener(NoRedirect).open(request, timeout=timeout)

class Client:
    def __init__(self, cache_dir, user_agent, fixtures=None, retries=4, interval=1.1):
        self.cache_dir = Path(cache_dir)
        self.user_agent = user_agent
        self.fixtures = fixtures
        self.retries = retries
        self.interval = max(1.0, interval)
        self.last_request = None

    def fetch(self, url):
        if self.fixtures is not None:
            if url not in self.fixtures:
                raise ValueError('Fixture missing exact request URL: ' + url)
            value = self.fixtures[url]
            return value, {'requestUrl': url, 'fetchedAt': None, 'mode': 'fixture',
                           'payloadSha256': digest(value)}
        filename = self.cache_dir / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if filename.exists():
            cached = json.loads(filename.read_text(encoding='utf-8'))
            if cached.get('requestUrl') != url or digest(cached.get('payload')) != cached.get('payloadSha256'):
                raise ValueError('Cache integrity failure: ' + str(filename))
            return cached['payload'], {k: cached[k] for k in ['requestUrl', 'fetchedAt', 'payloadSha256']} | {'mode': 'cache'}
        for attempt in range(self.retries + 1):
            if self.last_request is not None:
                time.sleep(max(0, self.interval - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                request = urllib.request.Request(url, headers={'User-Agent': self.user_agent, 'Accept': 'application/json'})
                with open_no_redirect(request, timeout=40) as response:
                    value = json.load(response)
                record = {'requestUrl': url, 'fetchedAt': now(), 'payloadSha256': digest(value), 'payload': value}
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                temporary = filename.with_suffix('.tmp-' + str(os.getpid()))
                temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
                temporary.replace(filename)
                return value, {k: record[k] for k in ['requestUrl', 'fetchedAt', 'payloadSha256']} | {'mode': 'network'}
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt == self.retries:
                    raise
                delay = min(60, 2 ** (attempt + 1))
                retry_after = error.headers.get('Retry-After', '')
                if retry_after.isdigit():
                    delay = max(delay, int(retry_after))
                time.sleep(delay)
            except (urllib.error.URLError, TimeoutError):
                if attempt == self.retries:
                    raise
                time.sleep(min(60, 2 ** (attempt + 1)))

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path, help='New candidate file, must not exist')
    parser.add_argument('--cache-dir', type=Path, default=Path('musicbrainz-cache'))
    parser.add_argument('--user-agent', help='Meaningful application/version (contact email or URL); required for network')
    parser.add_argument('--artist', action='append', default=[], type=parse_mapping, metavar='ENTITY_ID=MBID')
    parser.add_argument('--release-group', action='append', default=[], type=parse_mapping, metavar='ENTITY_ID=MBID')
    parser.add_argument('--release', action='append', default=[], type=parse_mapping, metavar='ENTITY_ID=MBID')
    parser.add_argument('--fixtures', type=Path, help='JSON object mapping exact request URL to response; disables network/cache writes')
    parser.add_argument('--dry-run', action='store_true', help='Write request plan only; never access network or cache')
    args = parser.parse_args(argv)
    if args.output.resolve() == args.catalog.resolve() or args.output.exists():
        parser.error('Output must be a new file distinct from catalog; no overwrite permitted')
    if not (args.dry_run or args.fixtures) and (not args.user_agent or '/' not in args.user_agent or not any(x in args.user_agent for x in ('@', 'https://', 'http://'))):
        parser.error('Network mode requires meaningful --user-agent with application/version and contact email or URL')
    catalog = load_catalog(args.catalog)
    requests, seen = [], set()
    for kind, mappings in [('artist', args.artist), ('release-group', args.release_group), ('release', args.release)]:
        for entity_id, mbid in mappings:
            if entity_id not in catalog:
                parser.error('Unknown catalog entity ID: ' + entity_id)
            key = (kind, entity_id, mbid)
            if key in seen:
                continue
            seen.add(key)
            requests.append({'entityId': entity_id, 'sourceType': kind, 'mbid': mbid, 'requestUrl': make_url(kind, mbid)})
    if not requests:
        parser.error('Supply at least one explicit mapping')
    result = {'schemaVersion': 1, 'generatedAt': now(), 'catalogSha256': hashlib.sha256(args.catalog.read_bytes()).hexdigest(),
              'purpose': 'review-only-candidates', 'catalogModified': False, 'requests': requests, 'candidates': [], 'errors': []}
    if args.dry_run:
        result['mode'] = 'dry-run'
    else:
        fixtures = json.loads(args.fixtures.read_text(encoding='utf-8')) if args.fixtures else None
        client = Client(args.cache_dir, args.user_agent, fixtures)
        for request in requests:
            try:
                raw, provenance = client.fetch(request['requestUrl'])
                if not isinstance(raw, dict) or raw.get('id') != request['mbid']:
                    raise ValueError('Response MBID differs from explicit mapping; review redirects/merged entities manually')
                result['candidates'].append({'entityId': request['entityId'], 'sourceType': request['sourceType'],
                    'status': 'candidate', 'reviewStatus': 'pending_reviewer',
                    'facts': extract(request['sourceType'], raw), 'serviceLinks': links(raw),
                    'provenance': dict(provenance, source='MusicBrainz', factsLicense='CC0-1.0',
                                       sourcePage='https://musicbrainz.org/' + request['sourceType'] + '/' + request['mbid'])})
            except (ValueError, OSError) as error:
                result['errors'].append(dict(request, error=str(error)))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(json.dumps({'output': str(args.output), 'candidates': len(result['candidates']), 'errors': len(result['errors']), 'dryRun': args.dry_run}))
    return 1 if result['errors'] else 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError) as error:
        print('Error: ' + str(error), file=sys.stderr)
        sys.exit(2)
