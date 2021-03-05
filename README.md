# dclip-video-renderer
This is the library that can convert your donkey clip into an mp4 clip.
To test just run your project 

```
npm i dclip-video-renderer;
node node_modules/dclip-video-renderer -- -i <clip_uid>;
```
where in `<clip_uid>` add the dockey clip uid you want to convert.

# Options
| argument | value type | description |
| --- | --- | ---
| -i | string | The unique donkey clip id as an Input |
| -o | string | The Output file path |
| -r | integer | The frameRate of the output video |
| -q | integer | The Quality of the video |
| -w | integer | The Width of the video |
| -h | integer | The Height of the video |
| -s | integer | The Start milisecond of the donkey clip |
| -e | integer | The end milisecond of the donkey clip |

#### Full Example
`node node_modules/dclip-video-renderer -- -i 7179a8c1-2DC3 -o ./dclip.mp4 -r 24 -q 80 -w 720 -h 640 -s 1000 -e 5000;`