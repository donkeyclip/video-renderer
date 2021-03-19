# dclip-video-renderer
This is the library that can convert your donkey clip into an mp4 clip.
To test just run your project 

```
npm i dclip-video-renderer;
node node_modules/dclip-video-renderer -- -i <clip_uid>;
```
where in `<clip_uid>` add the dockey clip uid you want to convert.

# Options
| argument | type|default | description |
| --- | --- | --- | ---
| -i | string | null | The unique donkey clip id as an Input |
| -o | string [*.mp4] | ./out.mp4  | The Output file path |
| -r | integer | 24  | FrameRate of the output video |
| -q | integer [0-100]| 80  | Quality of the video |
| -w | integer | 720 | Width of the video |
| -h | integer | 640|Height of the video |
| -s | integer | 0|Start milisecond of the donkey clip |
| -e | integer | <clip.duration>|End milisecond of the donkey clip |
| -c | integer | total cpus / 2 |Number of cpus to use |
| -env | integer ["local","staging","production"] | production | select the environmet from witch to check the id |
| -l | string | http://localhost:8090 | Enter the localhost url of the clip to render |

#### Full Example
`node node_modules/dclip-video-renderer -- -i 7179a8c1-2DC3 -o ./dclip.mp4 -r 24 -q 80 -w 720 -h 640 -s 1000 -e 5000 -c 4 -l http://locahost:8080;`