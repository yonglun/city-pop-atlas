import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('collector', Path(__file__).resolve().parents[1] / 'scripts' / 'collect_musicbrainz.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
ARTIST = 'ad62391d-ab7e-4ac9-9ce8-3704bc6746bb'
RELEASE = '11111111-2222-4333-8444-555555555555'
GROUP = '22222222-2222-4333-8444-555555555555'

class CollectorTests(unittest.TestCase):
    def test_service_links_strict(self):
        spotify = 'https://open.spotify.com/track/1234567890123456789012?si=abc'
        self.assertEqual(m.service_link(spotify)['url'], spotify.split('?')[0])
        self.assertEqual(m.service_link('https://youtu.be/uWqnsVMc8CQ?t=5')['externalId'], 'uWqnsVMc8CQ')
        self.assertEqual(m.service_link('https://music.youtube.com/watch?v=uWqnsVMc8CQ')['service'], 'youtube')
        for value in ['https://open.spotify.com.evil.test/track/1234567890123456789012',
                      'https://youtube.com@evil.test/watch?v=uWqnsVMc8CQ',
                      'https://evil@youtube.com/watch?v=uWqnsVMc8CQ',
                      'https://youtube.com/results?search_query=city+pop',
                      'https://youtube.com/watch?v=short',
                      'https://youtube.com/channel/UCxxxx',
                      'https://open.spotify.com/search/foo',
                      'https://open.spotify.com/track/short',
                      'javascript:alert(1)', 'https://youtube.com:bad/watch?v=uWqnsVMc8CQ']:
            self.assertIsNone(m.service_link(value), value)

    def test_fixture_collection_preserves_catalog(self):
        with tempfile.TemporaryDirectory() as temp:
            d = Path(temp)
            catalog, fixture, output = d/'catalog.json', d/'fixture.json', d/'candidates.json'
            catalog.write_text(json.dumps({'nodes':[{'id':'artist_a'}, {'id':'album_a'}]}))
            original = catalog.read_bytes()
            fixture.write_text(json.dumps({
                m.make_url('artist', ARTIST): {'id': ARTIST, 'name':'山下達郎', 'aliases':[{'name':'Tatsuro Yamashita'}],
                    'life-span':{'begin':'1953-02-04'}, 'area':{'name':'Japan'}, 'disambiguation':'singer',
                    'relations':[{'type':'streaming', 'url':{'resource':'https://youtu.be/uWqnsVMc8CQ'}}]},
                m.make_url('release-group', GROUP): {'id':GROUP, 'title':'Album', 'first-release-date':'1980', 'artist-credit':[{'name':'Singer'}]},
                m.make_url('release', RELEASE): {'id':RELEASE, 'title':'Album reissue', 'date':'2023',
                    'media':[{'position':1, 'format':'CD', 'tracks':[{'number':'1', 'title':'Song', 'length':120000,
                        'recording':{'id':GROUP, 'title':'Song', 'length':120000}}]}]}
            }))
            with patch.object(m, 'open_no_redirect', side_effect=AssertionError('Unexpected network')), contextlib.redirect_stdout(io.StringIO()):
                code = m.main(['--catalog',str(catalog),'--output',str(output),'--fixtures',str(fixture),
                    '--artist','artist_a='+ARTIST, '--release-group','album_a='+GROUP, '--release','album_a='+RELEASE])
            self.assertEqual(code, 0)
            result = json.loads(output.read_text())
            self.assertEqual(len(result['candidates']),3)
            self.assertEqual(result['candidates'][0]['serviceLinks'][0]['reviewStatus'],'pending_reviewer')
            self.assertFalse(result['candidates'][0]['serviceLinks'][0]['availabilityVerified'])
            self.assertEqual(result['candidates'][1]['facts']['first-release-date'],'1980')
            self.assertEqual(result['candidates'][2]['facts']['media'][0]['tracks'][0]['number'],'1')
            self.assertEqual(original,catalog.read_bytes())
            self.assertFalse((d/'cache').exists())

    def test_dry_run_and_overwrite_protection(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp); catalog=d/'catalog.json'; output=d/'plan.json'
            catalog.write_text('[{"id":"a"}]')
            argv=['--catalog',str(catalog),'--output',str(output),'--artist','a='+ARTIST,'--dry-run']
            with patch.object(m,'open_no_redirect',side_effect=AssertionError('Unexpected network')), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(m.main(argv),0)
            self.assertEqual(json.loads(output.read_text())['mode'],'dry-run')
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                m.main(argv)
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                m.main(['--catalog',str(catalog),'--output',str(catalog),'--artist','a='+ARTIST,'--dry-run'])

    def test_cached_data_integrity(self):
        with tempfile.TemporaryDirectory() as temp:
            client=m.Client(temp,'Atlas/1.0 (https://example.org/contact)')
            url=m.make_url('artist',ARTIST); raw={'id':ARTIST,'name':'Singer'}
            path=Path(temp)/(hashlib.sha256(url.encode()).hexdigest()+'.json')
            record={'requestUrl':url,'fetchedAt':'2026-10-02T00:00:00Z','payloadSha256':m.digest(raw),'payload':raw}
            path.write_text(json.dumps(record))
            with patch.object(m,'open_no_redirect',side_effect=AssertionError('Unexpected network')):
                self.assertEqual(client.fetch(url)[1]['mode'],'cache')
                record['payload']['name']='Tampered'; path.write_text(json.dumps(record))
                with self.assertRaises(ValueError): client.fetch(url)

    def test_backoff_and_redirect_rejection(self):
        with tempfile.TemporaryDirectory() as temp:
            client=m.Client(temp,'Atlas/1.0 (https://example.org/contact)',retries=1)
            url=m.make_url('artist',ARTIST)
            error=m.urllib.error.HTTPError(url,503,'Unavailable',{'Retry-After':'7'},None)
            with patch.object(m.time,'sleep') as sleep, patch.object(m,'open_no_redirect',side_effect=[error,io.StringIO('{"id":"ok"}')]) as request:
                self.assertEqual(client.fetch(url)[0]['id'],'ok')
                self.assertEqual(request.call_count,2)
                self.assertTrue(any(call.args[0]>=7 for call in sleep.call_args_list))
            self.assertIsNone(m.NoRedirect().redirect_request(None,None,301,'Moved',{},url))

    def test_rate_limit_between_requests(self):
        with tempfile.TemporaryDirectory() as temp:
            client=m.Client(temp,'Atlas/1.0 (https://example.org/contact)', interval=0.1)
            self.assertEqual(client.interval,1.0)
            response=io.StringIO('{"id":"anything"}')
            client.last_request=100.0
            with patch.object(m.time,'monotonic',return_value=100.2), patch.object(m.time,'sleep') as sleep, patch.object(m,'open_no_redirect',return_value=response):
                client.fetch(m.make_url('artist',ARTIST))
            self.assertAlmostEqual(sleep.call_args_list[0].args[0],0.8)

if __name__=='__main__': unittest.main()
