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
      dotTime = 75,
      triangleTime = 250,
      totalNumDots = 1000,
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

      const stage = new Konva.Stage({
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
          '#ffffff',
        );
        animateHexagon(hexagon, 500, 750);
      }

      stage.draw();
    }

    function onClickHexagon(event) {
      if (!hasStartedAnimation) {
        hasStartedAnimation = true;
        const { clientX, clientY } = event;
        startDrawingPoints(clientX, clientY);
      }
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
        fill: 'white',
      });
      text.offsetX(-text.width() / 2);
      text.offsetY(text.height() / 2);
      layer.add(text);
      return text;
    }

    function animatePoint(point, delay, duration) {
      let startTime;
      const animation = new Konva.Animation(function (frame) {
        if (frame.time > delay) {
          if (startTime == null) {
            startTime = frame.time;
            return;
          }
          const fractionDone = (frame.time - startTime) / duration;
          if (fractionDone > 1) {
            point.opacity(1);
            animation.stop();
            return;
          }
          point.opacity(fractionDone);
        } else {
          return false;
        }
      }, layer);
      animation.start();
    }

    function startDrawingPoints(pointX, pointY) {
      let text = createText(canvasMidPointX, canvasHeight - 40, '0');

      for (let i = 0; i < totalNumDots; i++) {
        {
          const point = drawPoint(pointX, pointY, 0);
          const delay = delays.next(false);
          animatePoint(point, delay, dotTime);
        }

        const edge = geometry.hexagon.randomEdge();
        const edgePositions = edge
          .map((v) => geometry.hexagon.vertexPositionByIndex(v, hexagonRadius))
          .map(([x, y]) => [x + canvasMidPointX, y + canvasMidPointY]);

        const vertex1 = [pointX, pointY];
        const [vertex2, vertex3] = edgePositions;
        const trianglePoints = [vertex1, vertex2, vertex3];

        if (i < 20) {
          const triangle = drawTriangle(vertex1, vertex2, vertex3);
          const pathLen = triangle.getLength();
          triangle.dash([0, pathLen]);
          layer.add(triangle);
          const delay = delays.next(true);
          animateTriangle(triangle, delay, triangleTime, pathLen);
        }

        [pointX, pointY] = geometry.centroid(trianglePoints);

        {
          const delay = delays.next(true);
          animateText(text, delay, String(i + 1));
        }
      }
    }

    function drawPoint(x, y, opacity) {
      const point = new Konva.Circle({
        radius: 1,
        x,
        y,
        fill: '#ffffff',
        opacity,
      });
      layer.add(point);
      return point;
    }

    function animateText(textObj, delay, text) {
      let changed = false;
      const animation = new Konva.Animation(function (frame) {
        if (frame.time > delay && !changed) {
          textObj.text(text);
          textObj.offsetX(textObj.width() / 2);
          changed = true;
        } else {
          return false;
        }
      }, layer);
      animation.start();
    }

    function animateTriangle(triangle, delay, duration, pathLen) {
      let startTime;
      const animation = new Konva.Animation(function (frame) {
        if (frame.time > delay) {
          if (startTime == null) {
            startTime = frame.time;
            return;
          }
          const fractionDone = (frame.time - startTime) / duration;
          if (fractionDone > 1) {
            animation.stop();
            return;
          }
          const dashLen = fractionDone * pathLen;
          triangle.dash([dashLen, pathLen - 2 * dashLen]);
        } else {
          return false;
        }
      }, layer);
      animation.start();
    }

    function createPath(data, x, y, stroke) {
      const path = new Konva.Path({
        data,
        x,
        y,
        stroke: stroke,
      });
      path.transformsEnabled('position');
      layer.add(path);
      return path;
    }

    function drawTriangle(x, y, z) {
      const triangle = new Konva.Path({
        data: `M ${x[0]},${x[1]} ${y[0]},${y[1]} ${z[0]},${z[1]} ${x[0]},${x[1]}`,
        stroke: '#ddaa0033',
      });
      triangle.transformsEnabled('position');
      return triangle;
    }

    var delays = (function () {
      let l = 0;
      let numDots = 0;
      const triangleTime = 250;

      function getDotTime() {
        if (numDots < 40) {
          return dotTime;
        }
        if (dotTime < 100) {
          return dotTime / 2;
        }
        return dotTime / 5;
      }

      function next(triangle) {
        if (triangle) {
          l += triangleTime;
        } else {
          l += getDotTime();
          numDots++;
        }
        return l;
      }

      function last() {
        return l;
      }

      return { next, last };
    })();

    function update() {}

    return { init, update };
  })();

  var animation = (function () {
    function animate() {
      graphics.update();
      requestAnimationFrame(animate);
    }

    function start() {
      graphics.init();
      animate();
    }

    return { start };
  })();

  animation.start();
})();
