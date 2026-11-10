import importlib.util
import os
import threading
import unittest
import hashlib
import hmac
import json
import time
from urllib.parse import urlencode
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import graph_storage


class MemoryBlob:
    objects = {}
    lock = threading.Lock()

    def __enter__(self): return self
    def __exit__(self, *args): pass
    def get(self, path, **kwargs):
        data = self.objects.get(path)
        return SimpleNamespace(content=data) if data is not None else None
    def put(self, path, body, **kwargs):
        with self.lock:
            if path in self.objects: raise ValueError('Unexpected overwrite')
            self.objects[path] = body
    def delete(self, path): self.objects.pop(path, None)
    def list_objects(self, prefix, **kwargs):
        return SimpleNamespace(blobs=[SimpleNamespace(pathname=p) for p in list(self.objects) if p.startswith(prefix)], has_more=False)


class CloudTests(unittest.TestCase):
    def setUp(self):
        MemoryBlob.objects = {}
        self.mock = patch.object(graph_storage, 'BlobClient', MemoryBlob)
        self.mock.start()
        self.env = patch.dict(os.environ, {'GIFTGRAPH_STORAGE': 'blob', 'GIFTGRAPH_SECRET': 'test-secret', 'BOT_TOKEN': '123:test'})
        self.env.start()
        spec = importlib.util.spec_from_file_location('cloud_test_server', Path(__file__).with_name('server.py'))
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.client = self.module.app.test_client()

    def login(self, uid, age=0, signature=None):
        fields = {'auth_date': str(int(time.time()) - age), 'user': json.dumps({'id': uid})}
        check = '\n'.join(f'{k}={v}' for k, v in sorted(fields.items()))
        secret = hmac.new(b'WebAppData', b'123:test', hashlib.sha256).digest()
        fields['hash'] = signature or hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        return self.client.post('/api/auth/telegram', json={'init_data': urlencode(fields)})

    def upload(self, owner):
        return self.client.post('/api/graphs', json={'html': '<html><head></head><body>Private</body></html>',
                                'label': f'Owner {owner}', 'owner_id': owner},
                                headers={'Authorization': 'Bearer test-secret'}).json['id']

    def tearDown(self):
        self.mock.stop()
        self.env.stop()

    def test_upload_read_restart_delete_and_auth(self):
        payload = {'html': '<html><head></head><body>Graph</body></html>', 'nodes': 3, 'edges': 2, 'label': 'Test', 'owner_id': 42}
        self.assertEqual(self.client.post('/api/graphs', json=payload).status_code, 401)
        response = self.client.post('/api/graphs', json=payload, headers={'Authorization':'Bearer test-secret'})
        self.assertEqual(response.status_code, 201)
        gid = response.json['id']
        # A different store instance must see persisted objects without a local index.
        self.module.GRAPH_STORE = graph_storage.BlobGraphStore()
        self.assertEqual(self.client.get('/health').json['storage'], 'blob')
        self.assertEqual(self.client.get('/api/graphs').status_code, 401)
        self.assertEqual(self.client.delete('/api/graphs/'+gid).status_code, 401)
        self.assertEqual(self.login(42).status_code, 200)
        self.assertEqual(self.client.get('/api/graphs').json['count'], 1)
        self.assertEqual(self.client.get('/graph/'+gid).text, payload['html'])
        page_headers = {'X-GiftGraph-Page': '1'}
        self.assertIn('giftgraph-toolbar', self.client.get('/view/'+gid, headers=page_headers).text)
        self.assertIn('Test', self.client.get('/', headers=page_headers).text)
        self.assertEqual(self.client.delete('/api/graphs/'+gid).status_code, 401)
        token = self.module._delete_token(gid)
        self.assertEqual(self.client.delete('/api/graphs/'+gid, headers={'X-GiftGraph-Delete-Token':token}).status_code, 200)
        self.assertEqual(self.client.get('/view/'+gid, headers=page_headers).status_code, 404)
        self.assertEqual(MemoryBlob.objects, {})

    def test_users_cannot_list_read_or_delete_each_others_graphs(self):
        first, second = self.upload(42), self.upload(99)
        self.module.GRAPH_STORE.save('abcdef123456', 'legacy', {'label': 'Unowned'})
        headers = {'X-GiftGraph-Page': '1'}
        for uid, own, other in [(42, first, second), (99, second, first)]:
            self.assertEqual(self.login(uid).status_code, 200)
            self.assertEqual(set(self.client.get('/api/graphs').json['graphs']), {own})
            home = self.client.get('/', headers=headers)
            self.assertIn(f'/view/{own}', home.text)
            self.assertNotIn(other, home.text)
            self.assertNotIn('Unowned', home.text)
            self.assertIn('no-store', home.headers['Cache-Control'])
            self.assertNotIn(own, self.client.get('/').text)
            self.assertEqual(self.client.get('/view/'+other, headers=headers).status_code, 404)
            self.assertEqual(self.client.get('/graph/'+other).status_code, 404)
            self.assertEqual(self.client.get('/graph/abcdef123456').status_code, 404)
            self.assertEqual(self.client.delete('/api/graphs/'+other, headers={
                'X-GiftGraph-Delete-Token': self.module._delete_token(other)}).status_code, 404)
            self.assertEqual(self.client.get('/graph/'+own).status_code, 200)

    def test_forged_and_expired_login_and_missing_owner_are_rejected(self):
        for kwargs in [{'signature': '0'*64}, {'age': 43201}, {'age': -120}]:
            self.assertEqual(self.login(42, **kwargs).status_code, 401)
            self.assertEqual(self.client.get('/api/graphs').status_code, 401)
        response = self.client.post('/api/graphs', json={'html': 'private'},
                                    headers={'Authorization': 'Bearer test-secret'})
        self.assertEqual(response.status_code, 400)

    def test_import_retry_and_incomplete_write(self):
        store = graph_storage.BlobGraphStore()
        gid = '123456abcdef'
        MemoryBlob.objects['graphs/'+gid+'.html'] = b'graph'
        store.save(gid, 'graph', {'label':'Original'})
        store.save(gid, 'graph', {'label':'Original'})
        with self.assertRaises(ValueError): store.save(gid, 'different', {'label':'Original'})
        self.assertEqual(store.html(gid), 'graph')
        self.assertEqual(store.info(gid)['label'], 'Original')

    def test_mobile_viewport_for_archived_snapshots(self):
        from html.parser import HTMLParser
        class Viewports(HTMLParser):
            def __init__(self):
                super().__init__()
                self.values = []
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'meta' and attrs.get('name', '').lower() == 'viewport':
                    self.values.append(attrs.get('content'))
        for original in ['', '<META content="width=1200" NAME=\'viewport\'>']:
            with self.subTest(original=original):
                result = self.module._inject_toolbar('<html><head>'+original+'</head><body>Graph</body></html>', '123456abcdef', {'label':'Test'})
                parser = Viewports()
                parser.feed(result)
                self.assertEqual(parser.values, ['width=device-width, initial-scale=1, viewport-fit=cover'])
                self.assertIn('Graph</body>', result)

    def test_distinct_writes_do_not_lose_archive_entries(self):
        from concurrent.futures import ThreadPoolExecutor
        store = graph_storage.BlobGraphStore()
        ids = [f'{n:012x}' for n in range(12)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda gid: store.save(gid, gid, {'label':gid}), ids))
        self.assertEqual(set(store.index()['graphs']), set(ids))


if __name__ == '__main__': unittest.main()
