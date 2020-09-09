const AIRPORT = "33.97%2C-84.98";
const RAPURL =
  `https://rucsoundings.noaa.gov/get_soundings.cgi?start=latest&airport=${AIRPORT}`;
const OUTFILE = `data.txt`;

const fetchData = async () => {
  const result = await fetch(RAPURL);
  const body = new Uint8Array(await result.arrayBuffer());
  await Deno.writeFile(OUTFILE, body);
  return body;
};

const body = await fetchData() || await Deno.readFile(OUTFILE);

const [, , , , , , , , ...rest] = new TextDecoder().decode(body).split(/\n/);

const data = rest.map((t) => {
  let [, linType, pressure, height, temp, dewPt, windDir, windSpd] = t.split(
    /[\s]+/,
  ).map((v) => Number(v));
  return {
    linType,
    pressure,
    height: Math.round(height * 3.28084) - 1083,
    temp: Number((((temp / 10) * 1.8) + 32).toFixed(1)),
    dewPt: Number((((dewPt / 10) * 1.8) + 32).toFixed(1)),
    windDir,
    windSpd: Math.round(windSpd * 1.15078),
  };
}).filter((o) => o.height < 15000);

console.log(data);
