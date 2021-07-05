"use strict";
const { isMainThread, parentPort, workerData } = require("worker_threads");
const captureframes = require("./worker");
const { handleError } = require("./lib");
(async function main() {
  try {
    if (isMainThread) {
      const {
        clgDonkeyLogo,
        getProcessArguments,
        prepareFramePartitions,
        createFramesWithWorkers,
        createVideo,
      } = require("./lib");

      clgDonkeyLogo();

      // read process arguments
      const { inputArguments, outputArguments } = await getProcessArguments();

      // prepare milliseconds for frames in
      // particions based on number of threads
      const { framePartitions, totalFrames } = prepareFramePartitions(
        inputArguments
      );

      // capture frame screenshots
      const frames = await createFramesWithWorkers(
        framePartitions,
        totalFrames,
        inputArguments
      );

      // creating the mp4 video
      createVideo(frames, outputArguments);
    } else {
      const workerFrames = await captureframes(workerData);
      parentPort.postMessage(workerFrames);
    }
  } catch (e) {
    handleError(e);
  }
})();
