import test from 'node:test';
import assert from 'node:assert/strict';
import {sameGoldenEvidence} from '../ci/golden-evidence-format.mjs';

test('P2 evidence: LF and Windows CRLF are equivalent only as line ending representations',()=>{
  const lf='{"schemaVersion":1,\n  "passed":30,\n  "fp":0}\n';
  assert.ok(sameGoldenEvidence(lf,lf));
  assert.ok(sameGoldenEvidence(lf.replace(/\n/g,'\r\n'),lf));
  assert.ok(!sameGoldenEvidence(lf.replace('"passed":30','"passed":29'),lf),'A changed count must still fail');
  assert.ok(!sameGoldenEvidence(lf.replace('"fp":0','"fp":1'),lf),'False positives must remain visible');
  assert.ok(!sameGoldenEvidence(lf.slice(0,-5),lf),'Truncated evidence must fail');
});
