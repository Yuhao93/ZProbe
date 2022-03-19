const Z_PROBE_UUID = '87606e9e-fe6f-4342-9f36-37bfc22a76c4';
const WRITE_UUID = '87606e9f-fe6f-4342-9f36-37bfc22a76c4';
const READ_UUID = '87606ea0-fe6f-4342-9f36-37bfc22a76c4';

const CANVAS_DRAW_WIDTH = 500;
const CANVAS_DRAW_HEIGHT = 400;
const PROBE_DISTANCE_MM = 5;
const SECONDS_PER_PROBE = 45;
const TEST_DEPTHS = false;

let zProbeDevice = null;
let zProbeWrite = null;
let zProbeRead = null;

let gcode = null;
let probePoints = null;
let depthMap = null;

const OpCode = {
  PING: 0,
  GCODE: 1,
  INIT: 2,
  PROBE: 3,
  END: 4
};

function promiseOf(obj, event, processor) {
  return new Promise((resolve, reject) => {
    obj[event] = (d) => {
      const res = processor(d);
      if (res) {
        resolve(res);
      }
    };
  });
}

async function writeOp(opCode, buffer) {
  const writeBuffer = new Uint8Array(20);
  writeBuffer.fill(0);
  writeBuffer[0] = opCode;

  if (buffer && buffer.byteLength > 0) {
    writeBuffer[1] = buffer.byteLength;
    for (let i = 0; i < buffer.byteLength; i++) {
      writeBuffer[2 + i] = buffer.buffer[i];
    }
  }

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

async function ping() {
  await writeOp(OpCode.PING);
  const answer = await zProbeRead.readValue();
  return assertOk(OpCode.PING, answer);
}

async function init(x, y) {
  const buffer = new ArrayBuffer(16);
  const dataView = new DataView(buffer);
  dataView.setFloat64(0, x, true);
  dataView.setFloat64(8, y, true);
  await writeOp(OpCode.INIT, dataView);
  const answer = await zProbeRead.readValue();
  return assertOk(OpCode.INIT, answer);
}

async function probe(x, y) {
  const buffer = new ArrayBuffer(16);
  const dataView = new DataView(buffer);
  dataView.setFloat64(0, x, true);
  dataView.setFloat64(8, y, true);
  await writeOp(OpCode.PROBE, dataView);
  const answer = await zProbeRead.readValue();
  return [
    answer.getFloat64(2, true),
    answer.getFloat64(10, true),
    answer.getFloat64(18, true)
  ];
}

async function end(x, y) {
  const buffer = new ArrayBuffer(16);
  const dataView = new DataView(buffer);
  dataView.setFloat64(0, x, true);
  dataView.setFloat64(8, y, true);
  await writeOp(OpCode.END, dataView);
  const answer = await zProbeRead.readValue();
  return assertOk(OpCode.END, answer);
}

function getDepth(x, y, zDepths) {
  if (TEST_DEPTHS) {
    return x * .1 + y * .1;
  }
  return zDepths.reduce((a, b) => a + b, 0) / zDepths.length;
}

function drawBoard(width, height, lines, probePoints) {
  const widthRatio = width / CANVAS_DRAW_WIDTH;
  const heightRatio = height / CANVAS_DRAW_HEIGHT;
  const drawRatio = Math.max(widthRatio, heightRatio);
  const drawWidth = width / drawRatio;
  const drawHeight = height / drawRatio;

  const canvasContext = document.querySelector('#probe-points').getContext('2d');
  canvasContext.fillStyle = 'black';
  canvasContext.fillRect(48, 48, drawWidth + 4, drawHeight + 4);
  canvasContext.fillStyle = '#fca903';
  canvasContext.fillRect(50, 50, drawWidth, drawHeight);

  for (const line of lines) {
    canvasContext.strokeStyle = line.isCut ? 'black' : 'lightGrey';
    canvasContext.beginPath();
    canvasContext.moveTo(50 + line.fromX / drawRatio, 50 + (height - line.fromY) / drawRatio);
    canvasContext.lineTo(50 + line.toX / drawRatio, 50 + (height - line.toY) / drawRatio);
    canvasContext.stroke();
  }

  canvasContext.fillStyle = '#0362fc';
  for (const point of probePoints) {
    canvasContext.beginPath();
    canvasContext.arc(
      50 + point.x / drawRatio,
      50 + (height - point.y) / drawRatio, 5, 0, 2 * Math.PI);
    canvasContext.fill();
  }
}


document.querySelector('#step-1-ok').onclick = () => {
  document.querySelector('#step-1').classList.add('disabled');
  document.querySelector('#step-2').classList.remove('hidden');
  window.scrollTo(0, document.body.scrollHeight);
};

document.querySelector('#step-2-ok').onclick = () => {
  document.querySelector('#step-2').classList.add('disabled');
  document.querySelector('#step-3').classList.remove('hidden');
  window.scrollTo(0, document.body.scrollHeight);
};

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
    document.querySelector('#step-3').classList.add('disabled');
    document.querySelector('#step-4').classList.remove('hidden');
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

document.querySelector('#ble-ping').onclick = async () => {
  if (!zProbeDevice) {
    alert('Device not connected!');
    return;
  }
  if (await ping()) {
    document.querySelector('#ble-ok-text').classList.remove('hidden');
    document.querySelector('#step-4').classList.add('disabled');
    document.querySelector('#step-5').classList.remove('hidden');
    window.scrollTo(0, document.body.scrollHeight);
  }
};

document.querySelector('#upload').addEventListener('change', async (evt) => {
  const file = evt.target.files[0];
  const reader = new FileReader();
  const fileRead = promiseOf(reader, 'onload', (e) => e.target.result);
  reader.readAsText(file);
  gcode = await fileRead;

  const result = await (await fetch('/parseGcode', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({gcode: gcode})
  })).json();

  const bounds = result.bounds;
  const lines = result.lines;

  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;

  probePoints = [];
  for (let x = bounds.xMin; x <= width; x++) {
    for (let y = bounds.yMin; y <= height; y++) {
      probePoints.push({  x: x, y: y });
      y += PROBE_DISTANCE_MM;
    }
    x += PROBE_DISTANCE_MM;
  }

  drawBoard(width, height, lines, probePoints);

  const timeEstimate = SECONDS_PER_PROBE * probePoints.length;
  const seconds = timeEstimate % 60;
  const minutes = Math.floor(timeEstimate / 60) % 60;
  const hours = Math.floor(timeEstimate / 3600);
  document.querySelector('#time-estimate').innerText =
    `Estimated time: ${hours}:${minutes}:${seconds}`;

  document.querySelector('#step-5').classList.add('disabled');
  document.querySelector('#step-6').classList.remove('hidden');
  window.scrollTo(0, document.body.scrollHeight);
}, false);

document.querySelector('#confirm').onclick = async () => {
  document.querySelector('#step-6').classList.add('disabled');
  document.querySelector('#step-7').classList.remove('hidden');
  window.scrollTo(0, document.body.scrollHeight);
};

document.querySelector('#ble-init').onclick = async () => {
  const firstPoint = probePoints[0];
  if (await init(firstPoint.x, firstPoint.y)) {
    document.querySelector('#step-7').classList.add('disabled');
    document.querySelector('#step-8').classList.remove('hidden');
    window.scrollTo(0, document.body.scrollHeight);
  }
};

document.querySelector('#ble-probe').onclick = async () => {
  depthMap = [];
  let isSuccess = true;
  let count = 0;
  for (const point of probePoints) {
    const res = await probe(point.x, point.y);
    if (!res) {
      isSuccess = false;
      break;
    }

    depthMap.push({
      x: point.x,
      y: point.y,
      z: getDepth(point.x, point.y, res)
    });
    count++;
    const percent = 100 * count / probePoints.length;
    document.querySelector('#progress').style.width = percent + '%';
  }
  if (isSuccess) {
    document.querySelector('#step-8').classList.add('disabled');
    document.querySelector('#step-9').classList.remove('hidden');
    window.scrollTo(0, document.body.scrollHeight);
  }
};

document.querySelector('#ble-end').onclick = async () => {
  const firstPoint = probePoints[0];
  if (await end(firstPoint.x, firstPoint.y)) {
    document.querySelector('#step-9').classList.add('disabled');
    document.querySelector('#step-10').classList.remove('hidden');
    window.scrollTo(0, document.body.scrollHeight);
  }
};

document.querySelector('#download').onclick = async () => {
  document.querySelector('#download-gcode').value = gcode;
  document.querySelector('#download-depthMap').value = JSON.stringify(depthMap);
  document.querySelector('#download-form').submit();
};
