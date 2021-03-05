"use strict";
const { Worker } = require("worker_threads");
const ffmpeg = require("ffmpeg-stream").ffmpeg;
const puppeteer = require("puppeteer");
const streamifier = require("streamifier");
const path = require("path");
const cliProgress = require("cli-progress");
const colors = require("colors");
const multibar = new cliProgress.MultiBar({
  format: "{name} |" + colors.cyan("{bar}") + "| {percentage}%",
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  hideCursor: true,
  clearOnComplete: false,
  hideCursor: true,
});

const progressBars = {
  initial: multibar.create(100, 0, {
    name: "Initialize    ",
  }),
  captureFrames: multibar.create(100, 0, {
    name: "Capture Frames",
  }),
  createVideo: multibar.create(100, 0, {
    name: "Create Video  ",
  }),
};

const lib = (module.exports = {});
lib.clgDonkeyLogo = () =>
  console.log(
    `
  _____                    _                      _____   _   _         
 |  __ \\                  | |                    / ____| | | (_)        
 | |  | |   ___    _ __   | | __   ___   _   _  | |      | |  _   _ __  
 | |  | |  / _ \\  | '_ \\  | |/ /  / _ \\ | | | | | |      | | | | | '_ \\ 
 | |__| | | (_) | | | | | |   <  |  __/ | |_| | | |____  | | | | | |_) |
 |_____/   \\___/  |_| |_| |_|\\_\\  \\___|  \\__, |  \\_____| |_| |_| | .__/ 
                                          __/ |                  | |    
                                         |___/                   |_|    `.concat(
      "\n\n"
    )
  );

lib.handleError = (e, options = {}) => {
  console.log("\n");
  if (options.messageOnly) {
    console.error(" " + e.message);
  } else {
    console.error(e);
  }
  console.log("\n");

  process.exit();
};
lib.createProgressBar = ({ totalValue, name, step }) =>
  multibar.create(bartotal, 0, {
    name: (() => {
      const newName = name;
      for (let i = 0; i < 25 - name.length; i++) {
        newName += " ";
      }
      return newName;
    })(),
    total,
    step,
  });
lib.getProcessArguments = async () => {
  const os = require("os");
  const cpuCount = os.cpus().length;
  const gpa = (arg) =>
    process.argv.indexOf(arg) + 1 &&
    process.argv[process.argv.indexOf(arg) + 1];

  const id = gpa("-i");
  const outputFullPath = gpa("-o") || "out.mp4";
  const frameRate = Number(gpa("-r")) || 24;
  const quality = Number(gpa("-q")) || 80;
  const width = Number(gpa("-w")) || 720; // set default to clip container params and a fallback
  const height = Number(gpa("-h")) || 640;

  const msStart = Number(gpa("-s")) || 0;
  let msEnd = Number(gpa("-e")) || 0;

  const threads = Number(gpa("-c")) || cpuCount / 2;
  const env = gpa("-env") || "production";
  let url;
  if (env == "production") {
    url = "https://staging-api.donkeyclip.com/embed/";
  } else if (env == "staging") {
    url = "https://staging-api.donkeyclip.com/embed/";
  } else if (env == "local") {
    url = "http://localhost:3030/embed/";
  }

  lib.checkIfOutputExists(outputFullPath);
  try {
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
    progressBars.initial.update(20);
    if (!msEnd) {
      msEnd = await page.evaluate(`window.mc.Player.clip.duration`);
    }
  } catch (e) {
    lib.handleError(e);
  }
  return {
    inputArguments: {
      id,
      width,
      height,
      msStart,
      msEnd,
      threads,
      env,
      url,
      frameRate,
      quality,
    },
    outputArguments: {
      outputFullPath,
      frameRate,
    },
  };
};

lib.checkIfOutputExists = (name) => {
  const fs = require("fs");

  try {
    if (fs.existsSync(name)) {
      lib.handleError(
        Error(
          `File '${name}' already exists. Please remove it or change the output name.`
        ),
        { messageOnly: true }
      );
    }
  } catch (err) {
    console.error(err);
  }
};
lib.prepareFramePartitions = (inputArguments) => {
  const { frameRate, msEnd, msStart, threads } = inputArguments;
  const step = 1000 / frameRate;

  const framePartitions = [];
  const partLength = Math.floor((msEnd - msStart) / step / threads);
  let part = 0;
  let totalFrames = 0;
  for (let ms = msStart; ms <= msEnd; ms += step) {
    totalFrames++;
    framePartitions[part] = framePartitions[part] || [];
    framePartitions[part].push(ms);

    if (framePartitions[part].length >= partLength) {
      part++;
    }
    progressBars.initial.update(80);
  }

  return { framePartitions, totalFrames };
};

lib.createFramesWithWorkers = async (
  framePartitions,
  totalFrames,
  inputArguments
) => {
  const framePromises = [];
  progressBars.captureFrames.start(totalFrames, 0, {
    name: "Capture Frames",
  });
  for (let i = 0; i < inputArguments.threads; i++) {
    framePromises.push(
      new Promise((resolve, reject) => {
        const workerpath = path.join(__dirname, "../", "index.js");
        const worker = new Worker(workerpath, {
          workerData: {
            url: inputArguments.url,
            id: inputArguments.id,
            millisecondsArray: framePartitions[i],
            width: inputArguments.width,
            height: inputArguments.height,
            quality: inputArguments.quality,
          },
        });
        progressBars.initial.update(80 + 20 / inputArguments.threads);
        worker.on("message", (message) => {
          if (message.increment) {
            progressBars.captureFrames.increment();
          } else {
            resolve(message);
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

  const frames = Promise.all(framePromises)
    .then((result) => {
      return result.reduce((prev, next) => [...prev, ...next], []);
    })
    .catch(lib.handleError);

  return frames;
};
lib.createVideo = (frames, outputArguments) => {
  const { outputFullPath, frameRate } = outputArguments;

  progressBars.createVideo.start(frames.length, 0, { name: "Create Video  " });

  const conv = ffmpeg(); // create converter
  const input = conv.input({ f: "image2pipe", r: frameRate });
  conv.output(path.join(process.cwd(), outputFullPath), {
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
      progressBars.createVideo.increment();
      return prev.then(next);
    }, Promise.resolve())
    .then(() => input.end())
    .catch(lib.handleError);

  conv
    .run()
    .then(() => {
      multibar.stop();
      console.log(" Enjoy!\n");
      return process.exit();
    })
    .catch(lib.handleError);
};
