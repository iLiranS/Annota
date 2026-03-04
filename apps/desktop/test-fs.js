import { stat } from "fs";
const p = "/Users/liran/Library/Application Support/com.annota.desktop/annota-images/";
stat(p, (err, stats) => {
    console.log(err, stats);
});
