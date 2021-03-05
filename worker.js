const puppeteer = require("puppeteer");
const { parentPort } = require("worker_threads");

module.exports = async ({
  url,
  id,
  millisecondsArray,
  width,
  height,
  quality,
}) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const frames = [];
  const page = await browser.newPage({ waitUntil: "networkidle" });

  await page.setViewport({
    width,
    height,
  });
  const htmlContent = `
        <body>
        <style>
          html,body{width:100%;height:100%;padding: 0;margin: 0;}
          #host{position: absolute;width:100%;height: 100%;top:0px;left: 0px}
        </style>
          <div id="host">
            <script data-scale-to-fit src="${url}${id}/"></script>
          </div>
        </body>
     `;
  const l = await page.setContent(htmlContent);

  for (const ms in millisecondsArray) {
    parentPort.postMessage({ increment: true });

    await page.evaluate(
      `window.mc.Player.createJourney(${millisecondsArray[ms]})`
    );
    const buffer = await page.screenshot({
      type: "jpeg",
      quality: quality,
    });
    frames.push(buffer);
  }
  return frames;
};
