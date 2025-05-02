import express from "express";
import fs from "fs/promises";
import bodyParser from "body-parser";

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const loadData = async () => {
  const [personsRaw, collegesRaw, researchesRaw] = await Promise.all([
    fs.readFile("./data/persons.json", "utf-8"),
    fs.readFile("./data/colleges.json", "utf-8"),
    fs.readFile("./data/researches.json", "utf-8"),
  ]);
  return {
    persons: JSON.parse(personsRaw),
    colleges: JSON.parse(collegesRaw),
    researches: JSON.parse(researchesRaw),
  };
};

app.post("/tool1", async (req, res) => {
  const input = req.body.input;

  if (input.startsWith("test")) {
    return res.json({ output: input });
  }

  const { researches } = await loadData();

  const research = researches.find((b) =>
    b.name.toLowerCase().includes("podróże w czasie")
  );

  if (!research) {
    return res.json({ output: "Nie znaleziono takich badań" })
  }

  const output = `Uczelnia: ${research?.college}, Sponsor: ${research.sponsor}`;

  return res.json({ output });
});

app.post("/tool2", async (req, res) => {
  const input = req.body.input;

  if (input.startsWith("test")) {
    return res.json({ output: input });
  }

  const collegeId = input.match(/Uczelnia:\s*(\w+)/)?.[1];

  if (!collegeId) {
    return res.json({ output: "Zadanie nie powiodło się" });
  }

  if (input.toLowerCase().includes("podaj ludzi")) {
    const { persons } = await loadData();

    const foundPeople = persons
      .filter((o) => o.uczelnia === collegeId)

    return res.json({ output: foundPeople })
  }

  if (input.toLowerCase().includes("podaj nazwę uczelni") || input.toLowerCase().includes("podaj nazwe uczelni")) {
    const { colleges } = await loadData();

    const foundCollege = colleges.find((c) => c.id === collegeId);

    if (!foundCollege) return res.json({ output: "Nie znaleziono uczelni" });

    return res.json({ output: foundCollege.name })
  }

  return res.json({ output: "Zadanie nie powiodło się" });
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
