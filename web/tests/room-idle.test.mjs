import test from 'node:test';
import assert from 'node:assert/strict';
import {startRoomIdle} from '../public/room-idle.js';

test('stopping idle playback cannot overwrite an explicitly selected animation',t=>{
  const pending=new Map();let sequence=0;
  t.mock.method(globalThis,'setTimeout',callback=>{pending.set(++sequence,callback);return sequence;});
  t.mock.method(globalThis,'clearTimeout',id=>pending.delete(id));
  const prior=globalThis.document;globalThis.document={hidden:false};
  t.after(()=>{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});
  const image={isConnected:true,src:'base.webp'};
  const actor={idle:[{file:'gesture.webp',duration:1000}]};
  const fire=()=>{const [id,callback]=pending.entries().next().value;pending.delete(id);callback();};
  const stop=startRoomIdle(image,actor,'base.webp',{reducedMotion:false});
  fire();assert.ok(image.src.endsWith('gesture.webp'));
  image.onload();assert.equal(pending.size,1);
  stop();image.src='clicked-animation.webp';
  assert.equal(pending.size,0);assert.equal(image.onload,null);
  assert.equal(image.src,'clicked-animation.webp');
  const stopAgain=startRoomIdle(image,actor,'base.webp',{reducedMotion:false});
  stopAgain();assert.equal(pending.size,0);
});

test('reduced motion and removed actors do not start another gesture',t=>{
  const callbacks=[];
  t.mock.method(globalThis,'setTimeout',callback=>{callbacks.push(callback);return callbacks.length;});
  const image={isConnected:true,src:'base.webp'},actor={idle:[{file:'gesture.webp',duration:1000}]};
  startRoomIdle(image,actor,'base.webp',{reducedMotion:true})();
  assert.equal(callbacks.length,0);
  startRoomIdle(image,actor,'base.webp',{reducedMotion:false});
  image.isConnected=false;callbacks[0]();
  assert.equal(image.src,'base.webp');assert.equal(callbacks.length,1);
});
