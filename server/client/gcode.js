const Z_PROBE_UUID = '87606e9e-fe6f-4342-9f36-37bfc22a76c4';
const WRITE_UUID = '87606e9f-fe6f-4342-9f36-37bfc22a76c4';
const READ_UUID = '87606ea0-fe6f-4342-9f36-37bfc22a76c4';

let zProbeDevice = null;
let zProbeWrite = null;
let zProbeRead = null;

const OpCode = {
  PING: 0,
  GCODE: 1,
  INIT: 2,
  PROBE: 3,
  END: 4
};

async function writeOp(opCode, buffer) {
  const writeBuffer = new Uint8Array(20);
  writeBuffer.fill(0);
  writeBuffer[0] = opCode;

  if (buffer && buffer.byteLength > 0) {
    writeBuffer[1] = buffer.byteLength;
    for (let i = 0; i < buffer.byteLength; i++) {
      writeBuffer[2 + i] = buffer.getUint8(i);
    }
  }

  console.log(writeBuffer);

  return await zProbeWrite.writeValueWithResponse(writeBuffer.buffer);
}

function readResponse(buffer) {
  const length = buffer.getUint8(1);
  const dataBuffer = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    dataBuffer[i] = buffer.getUint8(i + 2);
  }
  return dataBuffer;
}

function assertOk(expectedOpCode, answer) {
  const opCode = answer.getUint8(0);
  if (opCode != expectedOpCode) {
    alert('Got wrong op code response from device! Expected '
        + expectedOpCode + ' got ' + opCode);
    return false;
  }

  const data = readResponse(answer);
  const status = new TextDecoder().decode(data);

  if (status == 'OK') {
    return true;
  }

  alert('Expected OK, got: ' + status);
  return false;
}

async function gcode(gcodeToWrite) {
  const buffer = new ArrayBuffer(gcodeToWrite.length);
  const dataView = new DataView(buffer);
  for (let i = 0; i < gcodeToWrite.length; i++) {
    dataView.setUint8(i, gcodeToWrite.codePointAt(i))
  }
  await writeOp(OpCode.GCODE, dataView);
  const answer = await zProbeRead.readValue();
  return assertOk(OpCode.GCODE, answer);
}

document.querySelector('#ble-connect').onclick = async () => {
  try {
    zProbeDevice  = await navigator.bluetooth.requestDevice({
      filters: [{services: [Z_PROBE_UUID]}]
    });

    await zProbeDevice.gatt.connect();
    const service = await zProbeDevice.gatt.getPrimaryService(Z_PROBE_UUID);
    zProbeRead = await service.getCharacteristic(READ_UUID);
    zProbeWrite = await service.getCharacteristic(WRITE_UUID);

    document.querySelector('#ble-connect').classList.add('hidden');
    document.querySelector('#ble-disconnect').classList.remove('hidden');
    document.querySelector('#ble-connected-text').classList.remove('hidden');
    document.querySelector('#ble-disconnected-text').classList.add('hidden');
    document.querySelector('#connect').classList.add('disabled');
    document.querySelector('#gcode').classList.remove('hidden');
    window.scrollTo(0, document.body.scrollHeight);
  } catch (err) {
    console.log(err);
    alert('Failed to connect to device!')
  }
};

document.querySelector('#ble-disconnect').onclick = async () => {
  try {
    if (zProbeDevice) {
      zProbeDevice.gatt.disconnect();
    }
    document.querySelector('#ble-connect').classList.remove('hidden');
    document.querySelector('#ble-disconnect').classList.add('hidden');
    document.querySelector('#ble-connected-text').classList.add('hidden');
    document.querySelector('#ble-disconnected-text').classList.remove('hidden');
    window.scrollTo(0, document.body.scrollHeight);
  } catch (err) {
    console.log(err);
    alert('Failed to disconnect to device!');
  }
};

document.querySelector('#send').onclick = async () => {
  const gcodeToWrite = document.querySelector('#text').value;
  gcode(gcodeToWrite);

};
