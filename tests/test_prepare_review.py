import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).resolve().parents[1]/'scripts'/'prepare_review.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class PrepareTests(unittest.TestCase):
    def test_reject_fixtures_and_wrong_entity_layer(self):
        catalog={'nodes':[{'id':'album','type':'album','attributes':{}}]}
        c={'entityId':'album','sourceType':'release','facts':{'id':'123','date':'2008-07-01'},'provenance':{'mode':'network','fetchedAt':'2026-10-02T00:00:00Z'}}
        self.assertEqual(module.convert({'candidates':[c]},catalog)['candidates'],[])
        c['sourceType']='release-group';c['facts']['first-release-date']='1983-01-01';c['provenance']['mode']='fixture'
        self.assertEqual(module.convert({'candidates':[c]},catalog)['candidates'],[])
    def test_album_and_person_fact_candidates(self):
        catalog={'nodes':[{'id':'album','type':'album','attributes':{}}]}
        c={'entityId':'album','sourceType':'release-group','facts':{'id':'fixture-id','first-release-date':'1983-01-01'},'provenance':{'mode':'network','fetchedAt':'2026-10-02T00:00:00Z'}}
        out=module.convert({'candidates':[c]},catalog);self.assertEqual(out['candidates'][0]['field'],'releaseDate');self.assertEqual(out['status'],'pending_review')
