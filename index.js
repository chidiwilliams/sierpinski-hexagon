import Konva from 'konva';

(function () {
  const geometry = (function () {
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

    function linePath(point1, point2) {
      return `M ${point1[0]},${point1[1]} ${point2[0]},${point2[1]}`;
    }

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

    return { hexagon, centroid, linePath };
  })();

  const graphics = (function () {
    const primaryColor = '#ffffff';
    const secondaryColor = '#dd7700';

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
          primaryColor,
        );
        animateHexagon(hexagon, 500, 750);
      }

      stage.draw();
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
            updateLineDashLength(1, hexagon);
            animation.stop();
            return;
          }

          updateLineDashLength(fractionDone, hexagon);
        } else {
          return false;
        }
      }, layer);
      animation.start();
    }

    function onClickHexagon(event) {
      if (!hasStartedAnimation) {
        hasStartedAnimation = true;
        const { clientX, clientY } = event;
        animateDots(clientX, clientY);
      }
    }

    // Draws all dots in the hexagon starting from [pointX, pointY].
    function animateDots(pointX, pointY) {
      const maxNumDots = 20000;
      let numDrawnDots = 0;

      // Delay before drawing the inner lines as a fraction of the
      // duration of an animation step. If this value is 0.5, for
      // example, the inner lines to the centroid are drawn halfway
      // into the animation of the triangle.
      const innerLinesDelay = 0.5;

      let text = draw.text(
        canvasMidPointX - hexagonRadius,
        canvasMidPointY + hexagonRadius,
        `${numDrawnDots} points`,
      );
      let currentDot = null;
      let triangle = null;
      let lastStartTime = null;
      let isDotTime = true;
      let line1, line2, line3;

      const animation = new Konva.Animation(
        (frame) => {
          if (numDrawnDots >= maxNumDots) {
            animation.stop();
            return;
          }

          if (lastStartTime == null) {
            lastStartTime = frame.time;
            return false;
          }

          const duration = getDuration(numDrawnDots);
          const fractionDone = (frame.time - lastStartTime) / duration;
          if (fractionDone > 1) {
            if (isDotTime) {
              let nDotsToDraw = Math.min(
                Math.floor(fractionDone),
                maxNumDots - numDrawnDots,
              );

              let vertex1, vertex2, vertex3, centroid;
              for (let i = 0; i < nDotsToDraw; i++) {
                if (currentDot == null) currentDot = draw.dot(pointX, pointY);
                currentDot.opacity(1);

                vertex1 = [pointX, pointY];
                const edge = geometry.hexagon.randomEdge();
                [vertex2, vertex3] = edge
                  .map((v) =>
                    geometry.hexagon.vertexPositionByIndex(v, hexagonRadius),
                  )
                  .map(([x, y]) => [x + canvasMidPointX, y + canvasMidPointY]);
                const trianglePoints = [vertex1, vertex2, vertex3];
                centroid = geometry.centroid(trianglePoints);

                [pointX, pointY] = centroid;
                numDrawnDots++;
                currentDot = null;
              }

              if (triangle != null) triangle.remove();
              if (line1 != null) line1.remove();
              if (line2 != null) line2.remove();
              if (line3 != null) line3.remove();

              triangle = draw.triangle(vertex1, vertex2, vertex3);
              clearTriangleDashLength(triangle);
              layer.add(triangle);

              line1 = drawIncenterLine(vertex1, centroid);
              line2 = drawIncenterLine(vertex2, centroid);
              line3 = drawIncenterLine(vertex3, centroid);
              clearLineDashLength(line1, line2, line3);

              lastStartTime = frame.time;
              isDotTime = false;
              text.text(String(`${numDrawnDots} points`));
              return;
            }

            triangle.dash([]);
            updateLineDashLength(1, line1, line2, line3);

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
            updateTriangleDashLength(fractionDone, triangle);

            if (fractionDone > innerLinesDelay) {
              const lineFractionDone =
                (fractionDone - innerLinesDelay) / innerLinesDelay;
              updateLineDashLength(lineFractionDone, line1, line2, line3);
            }
          }
        },
        [layer],
      );
      animation.start();
    }

    function clearLineDashLength(...objects) {
      objects.forEach((object) => {
        const length = object.getLength();
        object.dashOffset(length);
        object.dash([length]);
      });
    }

    // Reduce the dash offset based on animation progress
    function updateLineDashLength(fractionDone, ...lines) {
      lines.forEach((line) => {
        const len = line.getLength();
        const dashLen = len - fractionDone * len;
        line.dashOffset(dashLen);
      });
    }

    function updateTriangleDashLength(fractionDone, triangle) {
      const pathLen = triangle.getLength();
      const dashLen = fractionDone * pathLen;
      triangle.dash([dashLen, pathLen - 2 * dashLen]);
    }

    function clearTriangleDashLength(object) {
      const pathLen = object.getLength();
      object.dash([0, pathLen]);
    }

    function drawIncenterLine(point1, point2) {
      return draw.path(geometry.linePath(point1, point2), 0, 0, secondaryColor);
    }

    // Returns the duration of the next animation
    // section based on how many dots have been drawn.
    function getDuration(numDots) {
      const initialDuration = 400;
      const numDotsAtInitialDuration = 0;
      const finalDuration = 0.3;
      const numDotsAtFinalDuration = 25;

      if (numDots < numDotsAtFinalDuration) {
        const grad =
          (finalDuration - initialDuration) /
          (numDotsAtFinalDuration - numDotsAtInitialDuration);
        return grad * numDots + initialDuration;
      }
      return finalDuration;
    }

    // Functions for creating new objects. Some add the object to layer.
    var draw = (function () {
      function triangle(x, y, z) {
        const triangle = new Konva.Path({
          data: `M ${x[0]},${x[1]} ${y[0]},${y[1]} ${z[0]},${z[1]} ${x[0]},${x[1]}`,
          stroke: secondaryColor,
        });
        triangle.transformsEnabled('position');
        triangle.perfectDrawEnabled(false);
        return triangle;
      }

      function path(data, x, y, strokeColor) {
        const path = new Konva.Path({
          data,
          x,
          y,
          stroke: strokeColor,
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
          fontSize: 16,
          fill: primaryColor,
        });
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
          fill: primaryColor,
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
