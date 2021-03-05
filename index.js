(async function () {
  const {
    Worker,
    isMainThread,
    parentPort,
    workerData,
  } = require("worker_threads");

  const os = require("os");
  const cpuCount = os.cpus().length;

  const captureScreenshots = require("./worker");

  if (isMainThread) {
    const ffmpeg = require("ffmpeg-stream").ffmpeg;
    const puppeteer = require("puppeteer");
    const streamifier = require("streamifier");
    const path = require("path");
    const cliProgress = require("cli-progress");

    console.log(`
  _____                    _                      _____   _   _         
 |  __ \\                  | |                    / ____| | | (_)        
 | |  | |   ___    _ __   | | __   ___   _   _  | |      | |  _   _ __  
 | |  | |  / _ \\  | '_ \\  | |/ /  / _ \\ | | | | | |      | | | | | '_ \\ 
 | |__| | | (_) | | | | | |   <  |  __/ | |_| | | |____  | | | | | |_) |
 |_____/   \\___/  |_| |_| |_|\\_\\  \\___|  \\__, |  \\_____| |_| |_| | .__/ 
                                          __/ |                  | |    
                                         |___/                   |_|    `);
    //Get Process Argument (GPA)
    const gpa = (arg) =>
      process.argv.indexOf(arg) + 1 &&
      process.argv[process.argv.indexOf(arg) + 1];
    const handleError = (e) => {
      progressFrames.stop();
      console.error(e.message + "\n");
      process.exit();
    };
    const progressFrames = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    );
    const progressFfmpeg = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    );

    (async () => {
      const id = gpa("-i");
      const output = gpa("-o") || "out.mp4";
      const frameRate = Number(gpa("-r")) || 25;
      const quality = Number(gpa("-q")) || 100;
      const width = Number(gpa("-w")) || 1920; // set default to clip container params and a fallback
      const height = Number(gpa("-h")) || 1080;

      const msStart = Number(gpa("-s")) || 0;
      let msEnd = Number(gpa("-e")) || 0;

      const threads = Number(gpa("-c")) || cpuCount / 2;
      const env = gpa("-env") || "production";
      let url;
      if (env == "production") {
        url = "https://api.donkeyclip.com/embed/";
      } else if (env == "staging") {
        url = "https://staging-api.donkeyclip.com/embed/";
      } else if (env == "local") {
        url = "http://localhost:3030/embed/";
      }
      try {
        console.log(" Initializing...\n");
        const browser = await puppeteer.launch({
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          headless: true,
        });
        const page = await browser.newPage({ waitUntil: "networkidle" });
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
        await page.setContent(htmlContent);

        if (!msEnd) {
          msEnd = await page.evaluate(`window.mc.Player.clip.duration`);
        }

        const step = 1000 / frameRate;
        //create the files

        const millisecondsPartitions = [];
        const partLength = Math.floor((msEnd - msStart) / step / threads);
        let part = 0;
        let totalScreeshots = 0;
        for (let ms = msStart; ms <= msEnd; ms += step) {
          totalScreeshots++;
          millisecondsPartitions[part] = millisecondsPartitions[part] || [];
          millisecondsPartitions[part].push(ms);

          if (millisecondsPartitions[part].length >= partLength) {
            part++;
          }
        }
        console.log(" Capturing frames...\n");

        progressFrames.start(totalScreeshots, 0);

        const screeshotPromises = [];

        for (let i = 0; i < threads; i++) {
          screeshotPromises.push(
            new Promise((resolve, reject) => {
              const worker = new Worker(__filename, {
                workerData: {
                  url,
                  id,
                  millisecondsArray: millisecondsPartitions[i],
                  width,
                  height,
                  quality,
                },
              });
              worker.on("message", (message) => {
                if (message.increment) {
                  progressFrames.increment();
                } else {
                  resolve({ i, message });
                }
              });
              worker.on("error", reject);
              worker.on("exit", (code) => {
                if (code !== 0)
                  reject(new Error(`Worker stopped with exit code ${code}`));
              });
            })
          );
        }

        const frames = await Promise.all(screeshotPromises).then((result) => {
          progressFrames.stop();
          return result.reduce((prev, next) => [...prev, ...next.message], []);
        });

        console.log(" Creating Video:");
        progressFfmpeg.start(frames.length, 0);
        const conv = ffmpeg(); // create converter
        const input = conv.input({ f: "image2pipe", r: frameRate });
        conv.output(path.join(process.cwd(), output), {
          vcodec: "libx264",
          pix_fmt: "yuv420p",
        });
        frames
          .map((buffer) => () =>
            new Promise((fulfill, reject) => {
              streamifier
                .createReadStream(buffer) //<--- here's the main difference
                .on("end", fulfill)
                .on("error", reject)
                .pipe(input, { end: false });
            })
          )
          .reduce((prev, next) => {
            progressFfmpeg.increment();
            return prev.then(next);
          }, Promise.resolve())
          .then(() => input.end())
          .catch(handleError);
        conv
          .run()
          .then(() => {
            progressFrames.stop();
            console.log(" Enjoy!\n");
            return process.exit();
          })
          .catch(handleError);
      } catch (e) {
        handleError(e);
      }
    })();
  } else {
    const threadFrames = await captureScreenshots(workerData);
    parentPort.postMessage(threadFrames);
  }
})();
