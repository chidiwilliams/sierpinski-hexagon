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
      const n = points.length;
      const x = points.reduce((acc, [x]) => acc + x, 0) / n;
      const y = points.reduce((acc, [, y]) => acc + y, 0) / n;
      return [x, y];
    }

    return { hexagon, centroid };
  })();

  var graphics = (function () {
    let layer,
      midX,
      h,
      midY,
      radius,
      dotTime = 75,
      triangleTime = 250,
      totalNumDots = 1000;

    function init() {
      h = window.innerHeight;
      const w = window.innerWidth;

      const container = document.querySelector('#container');
      container.style.width = `${w}px`;
      container.style.height = `${h}px`;

      midX = w / 2;
      midY = h / 2;
      const shorterAxes = h < w ? h : w;
      radius = 0.3 * shorterAxes;

      const width = window.innerWidth;
      const height = window.innerHeight;

      const stage = new Konva.Stage({
        container: 'container',
        width: width,
        height: height,
      });

      layer = new Konva.Layer({
        draggable: false,
      });
      stage.add(layer);

      {
        const hexagon = createHexagon(midX, midY, radius, 0);
        let clickedStart;
        hexagon.addEventListener('click', function (event) {
          if (!clickedStart) {
            clickedStart = true;
            const { clientX, clientY } = event;
            startDrawingPoints(clientX, clientY);
          }
        });
      }

      {
        const pathData = geometry.hexagon.path(radius);
        const hexagon = createPath(
          pathData,
          midX - radius,
          midY - radius,
          '#ffffff',
        );

        animateHexagon(hexagon, 500, 750);
      }

      stage.draw();
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
      let text = createText(midX, h - 40, '0');

      for (let i = 0; i < totalNumDots; i++) {
        {
          const point = drawPoint(pointX, pointY, 0);
          const delay = delays.next(false);
          animatePoint(point, delay, dotTime);
        }

        const edge = geometry.hexagon.randomEdge();
        const edgePositions = edge
          .map((v) => geometry.hexagon.vertexPositionByIndex(v, radius))
          .map(([x, y]) => [x + midX, y + midY]);

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

    return { init };
  })();

  graphics.init();
})();
