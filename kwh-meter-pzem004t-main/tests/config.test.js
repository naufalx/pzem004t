import { test } from 'node:test';
import assert from 'node:assert';
import configHandler from '../api/config.js';

test('Config API: returns client-safe Firebase Web configuration', async () => {
  let statusCode = 0;
  let headers = {};
  let responseData = null;

  const req = {
    method: 'GET',
    headers: {}
  };

  const res = {
    setHeader(key, val) {
      headers[key] = val;
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  configHandler(req, res);

  assert.strictEqual(statusCode, 200);
  assert.ok(responseData, 'Response data should exist');
  assert.strictEqual(responseData.projectId, 'kwh-meter-pzem004t');
  assert.ok(responseData.apiKey, 'apiKey should be defined');
  assert.strictEqual(responseData.databaseURL, 'https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app');
  assert.strictEqual(responseData.deviceId, 'kwh-meter-001');

  // Verify private key is NEVER exposed
  assert.strictEqual(responseData.private_key, undefined);
  assert.strictEqual(responseData.client_email, undefined);
});
