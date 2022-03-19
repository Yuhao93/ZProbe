const Interpreter = require('gcode-interpreter');

let hasLogged = false;

function buildCommand(cmd, params) {
  return cmd
      + ' '
      + Object.entries(params).map(([key, value]) => `${key}${value}`)
          .join(' ');
}

function mapValue(
    commandsList, cmd, currentPosition, depthMap, xValues, yValues, params) {
  const xPosition = params.X == null ? currentPosition.x : params.X;
  const yPosition = params.Y == null ? currentPosition.y : params.Y;
  const zPosition = params.Z == null ? currentPosition.z : params.Z;

  const newZ =
      interpolateDepth(
          xPosition, yPosition, zPosition, depthMap, xValues, yValues);
  params.Z = newZ;
  commandsList.push(buildCommand(cmd, params));

  currentPosition.x = xPosition;
  currentPosition.y = yPosition;
  currentPosition.z = zPosition;
}

function interpolateDepth(x, y, z, depthMap, xValues, yValues) {
  const minX = Math.max.apply(Math, xValues.filter(v => v <= x));
  const maxX = Math.min.apply(Math, xValues.filter(v => v > x));
  const minY = Math.max.apply(Math, yValues.filter(v => v <= y));
  const maxY = Math.min.apply(Math, yValues.filter(v => v > y));

  const depths = [
    depthMap[`x:${minX},y:${minY}`],
    depthMap[`x:${minX},y:${maxY}`],
    depthMap[`x:${maxX},y:${minY}`],
    depthMap[`x:${maxX},y:${maxY}`]
  ];

  const xDistance = (x - minX) / (maxX - minX);
  const yDistance = (y - minY) / (maxY - minY);

  const interpolatedOverX = [
    depths[0] + (depths[2] - depths[0]) * xDistance,
    depths[1] + (depths[3] - depths[1]) * xDistance
  ];

  const interpolatedDepth =
      interpolatedOverX[0]
          + (interpolatedOverX[1] - interpolatedOverX[0]) * yDistance;

  return z + interpolatedDepth;
}

function processDepthMap(depthMap, xValues, yValues) {
  const processedDepthMap =
      depthMap.reduce((a, {x, y, z}) => ({ ...a, [`x:${x},y:${y}`]: z}), {});
  const additionalEntries = {};

  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  for (const x of xValues) {
    const depth = processedDepthMap[`x:${x},y:${maxY}`];
    additionalEntries[`x:${x},y:${maxY + 5.1}`] = depth;
  }

  for (const y of yValues) {
    const depth = processedDepthMap[`x:${maxX},y:${y}`];
    additionalEntries[`x:${maxX + 5.1},y:${y}`] = depth;
  }

  const depth = processedDepthMap[`x:${maxX},y:${maxY}`];
  additionalEntries[`x:${maxX + 5.1},y:${maxY + 5.1}`] = depth;

  for (const key in additionalEntries) {
    processedDepthMap[key] = additionalEntries[key];
  }

  xValues.push(maxX + 5.1);
  yValues.push(maxY + 5.1);
  return processedDepthMap;
}

async function modifyGcode(req, resp) {
  const gcode = req.body.gcode;
  const depthMap = JSON.parse(req.body.depthMap);

  const currentPosition = {
    x: 0,
    y: 0
  };
  const xValues = [...new Set(depthMap.map(({x, y, z}) => x))];
  const yValues = [...new Set(depthMap.map(({x, y, z}) => y))];
  const processedDepthMap = processDepthMap(depthMap, xValues, yValues);

  const commands = [];
  new Interpreter({
    handlers: {
      'G0': mapValue.bind(
          this,
          commands,
          'G0',
          currentPosition,
          processedDepthMap,
          xValues,
          yValues),
      'G1': mapValue.bind(
          this,
          commands,
          'G1',
          currentPosition,
          processedDepthMap,
          xValues,
          yValues)
    },
    defaultHandler: (cmd, params) => {
      commands.push(buildCommand(cmd, params));
    }
  }).loadFromStringSync(gcode);
  resp.setHeader(
      'Content-disposition', 'attachment; filename="updatedGcode.cnc"');
  resp.setHeader('Content-type', 'text/plain');
  resp.write(commands.join('\r\n'));
  resp.end();
}

module.exports = modifyGcode;
