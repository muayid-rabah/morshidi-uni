import assert from 'node:assert/strict';
import { test } from 'node:test';
import { upstreamUrl } from './university';

test('proxy keeps fixed server origin and forwards only contract path/query', () => {
  const url = upstreamUrl('offerings', new URLSearchParams('path=offerings&term=2026-1'), 'https://university.example');
  assert.equal(url.href, 'https://university.example/v1/offerings?term=2026-1');
});
test('proxy rejects traversal and insecure remote upstreams', () => {
  for (const path of ['../auth', 'students/%2e%2e/auth', 'students\\auth', 'students?x=1'])
    assert.throws(() => upstreamUrl(path, new URLSearchParams(), 'https://university.example'));
  assert.throws(() => upstreamUrl('calendar', new URLSearchParams(), 'http://university.example'));
});
