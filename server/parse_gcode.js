const Interpreter = require('gcode-interpreter');

function logBound(bounds, lines, currentPosition, params) {
  const xValue = params.X == null ? currentPosition.x : params.X;
  const yValue = params.Y == null ? currentPosition.y : params.Y;
  const zValue = params.Z == null ? currentPosition.z : params.Z;
  if (xValue != currentPosition.x || yValue != currentPosition.y) {
    lines.push({
      fromX: currentPosition.x,
      fromY: currentPosition.y,
      toX: xValue,
      toY: yValue,
      isCut: zValue <= 0
    });
  }
  currentPosition.x = xValue;
  currentPosition.y = yValue;
  currentPosition.z = zValue;

  if (params.X || params.X == 0) {
    if (bounds.xMin == null || bounds.xMin > params.X) {
      bounds.xMin = params.X;
    }
    if (bounds.xMax == null || bounds.xMax < params.X) {
      bounds.xMax = params.X;
    }
  }
  if (params.Y || params.Y == 0) {
    if (bounds.yMin == null || bounds.yMin > params.Y) {
      bounds.yMin = params.Y;
    }
    if (bounds.yMax == null || bounds.yMax < params.Y) {
      bounds.yMax = params.Y;
    }
  }
}

async function parseGcode(req, resp) {
  const gcode = req.body.gcode;
  const bounds = {};
  const currentPosition = {x: 0, y:0};
  const lines = [];

  new Interpreter({
    handlers: {
      'G0': logBound.bind(this, bounds, lines, currentPosition),
      'G1': logBound.bind(this, bounds, lines, currentPosition)
    },
    defaultHandler: (cmd, params) => {}
  }).loadFromStringSync(gcode);
  resp.json({bounds, lines});
};


module.exports = parseGcode;
