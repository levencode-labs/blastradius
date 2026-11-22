import test from 'node:test';
import assert from 'node:assert/strict';
import {ids,readCase,evaluateCase,difference} from './helpers/golden-oracle.mjs';

assert.equal(ids.length,30,'Exactly 30 mandated T-001–T-030 golden fixtures must exist; no silent omission');
assert.deepEqual(ids,Array.from({length:30},(_,i)=>'T-'+String(i+1).padStart(3,'0')));
for(const id of ids){
  const {scenario,oracle}=readCase(id);
  test(`${id}: ${scenario.title}`,()=>{
    const actual=evaluateCase(scenario,oracle);
    const {failures,probes}=difference(oracle,actual);
    assert.equal(failures.length,0,failures.join('\n')+'\n'+JSON.stringify({expected:oracle,actual,probes},null,2));
  });
}
