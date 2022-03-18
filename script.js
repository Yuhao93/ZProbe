const Z_PROBE_UUID = '00001234-0000-1000-8000-00805f9b34fb';
const WRITE_UUID = '00001234-0000-1000-8000-00805f9b34fb';
const READ_UUID = '00001234-0000-1000-8000-00805f9b34fb';

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

function readResponse(buffer) {
  const length = buffer.getUint8(1);
  const dataBuffer = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    dataBuffer[i] = buffer[i + 2];
  }
  return dataBuffer;
}

function assertOk(expectedOpCode, answer) {
  const opCode = answer.getUint8(0);
  if (opCode != OpCode.PING) {
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

async function ping() {
  const byteBuffer = new Uint8Array(1);
  byteBuffer[0] = OpCode.PING;
  await zProbeWrite.writeValueWithoutResponse(byteBuffer.buffer);
  await zProbeRead.startNotifications();

  return assertOk(zProbeRead.value);
}


document.querySelector('#step-1-ok').onclick = () => {
  document.querySelector('#step-1').classList.add('disabled');
  document.querySelector('#step-2').classList.remove('hidden');
};

document.querySelector('#step-2-ok').onclick = () => {
  document.querySelector('#step-2').classList.add('disabled');
  document.querySelector('#step-3').classList.remove('hidden');
};

document.querySelector('#ble-connect').onclick = async () => {
  try {
    /*zProbeDevice  = await navigator.bluetooth.requestDevice({
      filters: [{services: [Z_PROBE_UUID]}]
    });


    const service = await zProbeDevice.gatt.getPrimaryService(Z_PROBE_UUID);
    zProbeRead = await service.getCharacteristic(READ_UUID);
    zProbeWrite = await service.getCharacteristic(WRITE_UUID);*/

    document.querySelector('#ble-connect').classList.add('hidden');
    document.querySelector('#ble-disconnect').classList.remove('hidden');
    document.querySelector('#ble-connected-text').classList.remove('hidden');
    document.querySelector('#ble-disconnected-text').classList.add('hidden');
    document.querySelector('#step-3').classList.add('disabled');
    document.querySelector('#step-4').classList.remove('hidden');
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
  } catch (err) {
    console.log(err);
    alert('Failed to disconnect to device!');
  }
};

document.querySelector('#ble-ping').onclick = async () => {
  if (!zProbeDevice) {
    alert('Device not connected!');
    return;
  }
  if (await ping()) {
    document.querySelector('#ble-ok-text').classList.remove('hidden');
    document.querySelector('#step-4').classList.add('disabled');
    document.querySelector('#step-4').classList.remove('hidden');
  }
};
