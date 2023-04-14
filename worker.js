/* eslint-disable @typescript-eslint/no-var-requires */
const puppeteer = require("puppeteer");
const { parentPort } = require("worker_threads");

module.exports = async ({
  url,
  millisecondsArray,
  width,
  height,
  quality,
  headless,
}) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const frames = [];
  const page = await browser.newPage({ waitUntil: "networkidle2" });

  await page.setViewport({
    width,
    height,
  });

  await page.goto(url, { waitUntil: "networkidle2" });

  for (const ms in millisecondsArray) {
    parentPort.postMessage({ increment: true });

    await page.evaluate(
      (millisecondsArray, ms) =>
        window.document
          .getElementsByTagName("donkey-clip")[0]
          .setAttribute("ms", millisecondsArray[ms]),
      millisecondsArray,
      ms
    );
    const buffer = await page.screenshot({
      type: "jpeg",
      quality: quality,
    });
    frames.push(buffer);
  }
  return frames;
};
