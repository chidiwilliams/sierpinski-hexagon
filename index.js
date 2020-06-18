import Konva from 'konva';

(function () {
  var geometry = (function () {
    var hexagon = (function () {
      // Returns a random pair of adjacent vertices.
      function randomEdge() {
        const vertex = Math.floor(Math.random() * 6);
        return [vertex, (vertex + 1) % 6];
      }

      // Returns the [x, y] position of a vertex given the hexagon's
      // radius and assuming the hexagon's center at [0, 0].
      function vertexPositionByIndex(index, radius) {
        const angle = ((30 + index * 60) * Math.PI) / 180;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      }

      // Returns an SVG outline path for the hexagon with given radius
      function path(radius) {
        const angle = (30 * Math.PI) / 180;
        const cosL = Math.cos(angle) * radius;
        const sinL = Math.sin(angle) * radius;
        const tanL = 1 * radius;
        return `m ${tanL},0 ${cosL},${sinL} 0,${tanL} -${cosL},${sinL} -${cosL},-${sinL} 0,-${tanL} ${cosL},-${sinL}`;
      }

      return { randomEdge, vertexPositionByIndex, path };
    })();

    // Returns the position of the centroid of the given points.
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

    // Draws all the initial graphics and adds the click listener.
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
        const hexagon = draw.hexagon(
          canvasMidPointX,
          canvasMidPointY,
          hexagonRadius,
          0,
        );
        hexagon.addEventListener('click', onClickHexagon);
      }

      {
        const pathData = geometry.hexagon.path(hexagonRadius);
        const hexagon = draw.path(
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

    // Draws all dots in the hexagon starting from [pointX, pointY].
    function startAnimation(pointX, pointY) {
      const maxNumDots = 1000;
      let numDots = 0;

      let text = draw.text(canvasMidPointX, canvasHeight - 40, numDots);
      let currentDot = null;
      let triangle = null;
      let lastStartTime = null;
      let isDotTime = true;

      const animation = new Konva.Animation(
        (frame) => {
          if (numDots == maxNumDots) {
            animation.stop();
            return;
          }

          if (lastStartTime == null) {
            lastStartTime = frame.time;
            return false;
          }

          const duration = getDuration(numDots);
          const fractionDone = (frame.time - lastStartTime) / duration;
          if (fractionDone > 1) {
            if (isDotTime) {
              if (currentDot == null) currentDot = draw.dot(pointX, pointY);

              currentDot.opacity(1);

              const vertex1 = [pointX, pointY];
              const edge = geometry.hexagon.randomEdge();
              const [vertex2, vertex3] = edge
                .map((v) =>
                  geometry.hexagon.vertexPositionByIndex(v, hexagonRadius),
                )
                .map(([x, y]) => [x + canvasMidPointX, y + canvasMidPointY]);
              const trianglePoints = [vertex1, vertex2, vertex3];
              [pointX, pointY] = geometry.centroid(trianglePoints);

              if (triangle != null) {
                triangle.remove();
              }

              triangle = draw.triangle(vertex1, vertex2, vertex3);
              const pathLen = triangle.getLength();
              triangle.dash([0, pathLen]);
              layer.add(triangle);

              lastStartTime = frame.time;
              currentDot = null;
              isDotTime = false;

              text.text(String(++numDots));
              text.offsetX(text.width() / 2);
              return;
            }

            triangle.dash([]);

            lastStartTime = frame.time;
            currentDot = null;
            isDotTime = true;
            return;
          }

          if (isDotTime) {
            if (currentDot == null) {
              currentDot = draw.dot(pointX, pointY);
              return;
            }
            currentDot.opacity(fractionDone);
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

    // Returns the duration of the next animation
    // section based on how many dots have been drawn.
    function getDuration(numDots) {
      const initialDuration = 400;
      const numDotsAtInitialDuration = 0;
      const finalDuration = 1;
      const numDotsAtFinalDuration = 50;

      if (numDots < numDotsAtFinalDuration) {
        const grad =
          (finalDuration - initialDuration) /
          (numDotsAtFinalDuration - numDotsAtInitialDuration);
        return grad * numDots + initialDuration;
      }
      return finalDuration;
    }

    function animateHexagon(hexagon, delay, duration) {
      // Sets the hexagon's dash outline to full length and offsets it to full length.
      // Effectively removes the full outline.
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
            // Completely remove the offset. Resets the outline to full length.
            hexagon.dashOffset(0);
            animation.stop();
            return;
          }

          // Reduce the dash offset based on animation progress
          const dashLen = length - fractionDone * length;
          hexagon.dashOffset(dashLen);
        } else {
          return false;
        }
      }, layer);
      animation.start();
    }

    // Functions for creating new objects. Some add the object to layer.
    var draw = (function () {
      function triangle(x, y, z) {
        const triangle = new Konva.Path({
          data: `M ${x[0]},${x[1]} ${y[0]},${y[1]} ${z[0]},${z[1]} ${x[0]},${x[1]}`,
          stroke: '#ddaa0099',
        });
        triangle.transformsEnabled('position');
        triangle.perfectDrawEnabled(false);
        return triangle;
      }

      function path(data, x, y) {
        const path = new Konva.Path({
          data,
          x,
          y,
          stroke: '#ffffff',
        });
        path.transformsEnabled('position');
        path.perfectDrawEnabled(false);
        layer.add(path);
        return path;
      }

      function text(x, y, content) {
        const text = new Konva.Text({
          x,
          y,
          text: content,
          fontSize: 20,
          fill: '#ffffff',
        });
        text.offsetX(text.width() / 2);
        text.offsetY(text.height() / 2);
        text.transformsEnabled('position');
        text.perfectDrawEnabled(false);
        layer.add(text);
        return text;
      }

      function hexagon(x, y, radius, opacity) {
        const hexagon = new Konva.RegularPolygon({
          radius: radius,
          sides: 6,
          x,
          y,
          opacity,
        });
        hexagon.perfectDrawEnabled(false);
        hexagon.transformsEnabled('position');
        layer.add(hexagon);
        return hexagon;
      }

      function dot(x, y) {
        const dot = new Konva.Circle({
          radius: 1,
          x: x,
          y: y,
          fill: '#ffffff',
          opacity: 0,
        });
        dot.perfectDrawEnabled(false);
        dot.transformsEnabled('position');
        layer.add(dot);
        return dot;
      }

      return { triangle, path, text, hexagon, dot };
    })();

    return { init };
  })();

  graphics.init();
})();
