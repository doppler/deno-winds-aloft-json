import { Application, Router } from "https://deno.land/x/oak@v6.2.0/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

const argPort = parse(Deno.args).port;
const PORT = argPort ? Number(argPort) : 5002;

const fetchData = async (latitude: string, longitude: string) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const d = new Date();
  const queryObj = {
    airport: `${latitude}%2C${longitude}`,
    startSecs: Math.floor(Date.now() / 1000),
    endSecs: Math.floor(Date.now() / 1000) + 3600,
  };
  const queryStr = Object.entries(queryObj)
    .map((pair) => pair.join("="))
    .join("&");
  // console.log(queryStr);
  // const queryStr = `start=latest&airport=${latitude}%2C${longitude}`
  const result = await fetch(
    `https://rucsoundings.noaa.gov/get_soundings.cgi?${queryStr}`,
  );
  const body = new Uint8Array(await result.arrayBuffer());
  // await Deno.writeFile('data.txt', body);
  return body;
};

const transformData = (body: Uint8Array, elevation: number = 0) => {
  const decodedBody = new TextDecoder().decode(body);
  // console.log(decodedBody);
  const [, op40, , cape1, , , surface, , ...rest] = decodedBody.split(/\n/);
  const [type, hour, day, month, year] = op40.split(/[\s]+/);
  const [, , , , latitude, longitude] = cape1.split(/[\s]+/);
  const soundings = [surface, ...rest];
  return {
    type,
    hour: Number(hour),
    month,
    day: Number(day),
    year: Number(year),
    latitude: Number(latitude),
    longitude: Number(longitude),
    elevation,
    soundings: soundings
      .map((t) => {
        let [
          ,
          linType,
          pressure,
          height,
          temp,
          dewPt,
          windDir,
          windSpd,
        ] = t.split(/[\s]+/).map((v) => Number(v));
        return {
          linType,
          pressure: pressure / 10,
          height: {
            meters: height - elevation,
            feet: Math.round((height - elevation) * 3.28084),
          },
          temp: {
            c: temp / 10,
            f: Number(((temp / 10) * 1.8 + 32).toFixed(1)),
          },
          dewPt: {
            c: dewPt / 10,
            f: Number(((dewPt / 10) * 1.8 + 32).toFixed(1)),
          },
          windDir,
          windSpd: {
            kts: windSpd,
            mph: Math.round(windSpd * 1.15078),
          },
        };
      })
      .filter((o) => o.height.feet < 16000),
  };
};

const router = new Router();

router
  .get("/", (ctx) => {
    ctx.response.body = "Usage: /latitude/longitude/elevation";
  })
  .get("/:latitude/:longitude/:elevation?", async (ctx) => {
    if (ctx.params && ctx.params.latitude && ctx.params.longitude) {
      const elevation = Number(ctx.params.elevation) || 0;
      const body = await fetchData(ctx.params.latitude, ctx.params.longitude);
      ctx.response.type = "application/json";
      ctx.response.headers.append("Access-Control-Allow-Origin", "*");
      ctx.response.body = transformData(body, elevation);
    }
  });

const app = new Application();

app.addEventListener("listen", ({ hostname, port, secure }) => {
  console.log(
    `Listening on: ${secure ? "https://" : "http://"}${hostname ??
      "localhost"}:${port}`,
  );
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: PORT });
