import Konva from 'konva';

(function () {
  var geometry = (function () {
    var hexagon = (function () {
      function randomEdge() {
        const vertex = Math.floor(Math.random() * 6);
        return [vertex, (vertex + 1) % 6];
      }

      function vertexPositionByIndex(index, radius) {
        const angle = ((30 + index * 60) * Math.PI) / 180;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      }

      function path(radius) {
        const angle = (30 * Math.PI) / 180;
        const cosL = Math.cos(angle) * radius;
        const sinL = Math.sin(angle) * radius;
        const tanL = 1 * radius;
        return `m ${tanL},0 ${cosL},${sinL} 0,${tanL} -${cosL},${sinL} -${cosL},-${sinL} 0,-${tanL} ${cosL},-${sinL}`;
      }

      return { randomEdge, vertexPositionByIndex, path };
    })();

    function centroid(points) {
      let totalX = 0;
      let totalY = 0;
      points.forEach(([x, y]) => {
        totalX += x;
        totalY += y;
      });
      return [totalX / points.length, totalY / points.length];
    }

    return { hexagon, centroid };
  })();

  var graphics = (function () {
    let layer,
      canvasHeight,
      canvasMidPointX,
      canvasMidPointY,
      hexagonRadius,
      stage,
      hasStartedAnimation = false;

    function init() {
      canvasHeight = window.innerHeight;
      const canvasWidth = window.innerWidth;

      {
        const container = document.querySelector('#container');
        container.style.width = `${canvasWidth}px`;
        container.style.height = `${canvasHeight}px`;
      }

      canvasMidPointX = canvasWidth / 2;
      canvasMidPointY = canvasHeight / 2;

      {
        const shorterCanvasAxis =
          canvasHeight < canvasWidth ? canvasHeight : canvasWidth;
        hexagonRadius = 0.3 * shorterCanvasAxis;
      }

      stage = new Konva.Stage({
        container: 'container',
        width: canvasWidth,
        height: canvasHeight,
      });

      layer = new Konva.Layer({
        draggable: false,
      });
      stage.add(layer);

      {
        const hexagon = createHexagon(
          canvasMidPointX,
          canvasMidPointY,
          hexagonRadius,
          0,
        );
        hexagon.addEventListener('click', onClickHexagon);
      }

      {
        const pathData = geometry.hexagon.path(hexagonRadius);
        const hexagon = createPath(
          pathData,
          canvasMidPointX - hexagonRadius,
          canvasMidPointY - hexagonRadius,
        );
        animateHexagon(hexagon, 500, 750);
      }

      stage.draw();
    }

    function onClickHexagon(event) {
      if (!hasStartedAnimation) {
        hasStartedAnimation = true;
        const { clientX, clientY } = event;
        startAnimation(clientX, clientY);
      }
    }

    function startAnimation(pointX, pointY) {
      let numDots = 0;

      let text = createText(canvasMidPointX, canvasHeight - 40, numDots);
      let lastDot = null;
      let triangle = null;
      let lastDuration = 500;
      let lastStartTime = null;
      let vertex1, vertex2, vertex3;

      let isDotTime = true;

      const animation = new Konva.Animation(
        (frame) => {
          if (lastStartTime == null) {
            lastStartTime = frame.time;
            return false;
          }

          const fractionDone = (frame.time - lastStartTime) / lastDuration;
          if (fractionDone > 1) {
            if (isDotTime) {
              if (lastDot == null) lastDot = drawCircle(pointX, pointY);

              lastDot.opacity(1);

              vertex1 = [pointX, pointY];
              const edge = geometry.hexagon.randomEdge();
              [vertex2, vertex3] = edge
                .map((v) =>
                  geometry.hexagon.vertexPositionByIndex(v, hexagonRadius),
                )
                .map(([x, y]) => [x + canvasMidPointX, y + canvasMidPointY]);
              const trianglePoints = [vertex1, vertex2, vertex3];
              [pointX, pointY] = geometry.centroid(trianglePoints);

              if (triangle != null) {
                triangle.remove();
              }

              triangle = drawTriangle(vertex1, vertex2, vertex3);
              const pathLen = triangle.getLength();
              triangle.dash([0, pathLen]);
              layer.add(triangle);

              lastStartTime = frame.time;
              lastDot = null;
              isDotTime = false;

              text.text(String(++numDots));
              return;
            }

            triangle.dash([]);

            lastStartTime = frame.time;
            lastDot = null;
            isDotTime = true;
            return;
          }

          if (isDotTime) {
            if (lastDot == null) {
              lastDot = drawCircle(pointX, pointY);
              return;
            }
            lastDot.opacity(fractionDone);
          } else {
            const pathLen = triangle.getLength();
            const dashLen = fractionDone * pathLen;
            triangle.dash([dashLen, pathLen - 2 * dashLen]);
          }
        },
        [layer],
      );
      animation.start();
    }

    function drawCircle(x, y) {
      const dot = new Konva.Circle({
        radius: 1,
        x: x,
        y: y,
        fill: '#ffffff',
        opacity: 0,
      });
      layer.add(dot);
      return dot;
    }

    function animateHexagon(hexagon, delay, duration) {
      const length = hexagon.getLength();
      hexagon.dashOffset(length);
      hexagon.dash([length]);

      let startTime = null;
      const animation = new Konva.Animation(function (frame) {
        if (frame.time > delay) {
          if (startTime == null) {
            startTime = frame.time;
            return false;
          }
          const fractionDone = (frame.time - startTime) / duration;
          if (fractionDone > 1) {
            hexagon.dashOffset(0);
            animation.stop();
            return;
          }
          const dashLen = length - fractionDone * length;
          hexagon.dashOffset(dashLen);
        } else {
          return false;
        }
      }, layer);
      animation.start();
    }

    function createHexagon(x, y, radius, opacity) {
      const hexagon = new Konva.RegularPolygon({
        radius: radius,
        sides: 6,
        x,
        y,
        opacity,
      });
      hexagon.transformsEnabled('position');
      layer.add(hexagon);
      return hexagon;
    }

    function createText(x, y, content) {
      const text = new Konva.Text({
        x,
        y,
        text: content,
        fontSize: 20,
        fill: '#ffffff',
      });
      text.offsetX(text.width() / 2);
      text.offsetY(text.height() / 2);
      layer.add(text);
      return text;
    }

    function createPath(data, x, y) {
      const path = new Konva.Path({
        data,
        x,
        y,
        stroke: '#ffffff',
      });
      path.transformsEnabled('position');
      layer.add(path);
      return path;
    }

    function drawTriangle(x, y, z) {
      const triangle = new Konva.Path({
        data: `M ${x[0]},${x[1]} ${y[0]},${y[1]} ${z[0]},${z[1]} ${x[0]},${x[1]}`,
        stroke: '#ddaa0099',
      });
      triangle.transformsEnabled('position');
      return triangle;
    }

    return { init };
  })();

  graphics.init();
})();
