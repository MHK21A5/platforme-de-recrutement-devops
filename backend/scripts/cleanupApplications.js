/**
 * cleanupApplications.js — nettoyage ponctuel des candidatures incohérentes.
 *
 * Corrige trois cas :
 *   1. Candidature dont l'offre (Job) n'existe plus        → suppression
 *   2. Candidature dont le candidat (User) n'existe plus   → suppression
 *   3. Candidature "accepted" sans entretien correspondant → repassée en "pending"
 *      (l'entretien a été supprimé : la candidature revient dans la file du recruteur)
 *
 * Usage :
 *   node scripts/cleanupApplications.js            # DRY-RUN (n'écrit rien)
 *   node scripts/cleanupApplications.js --apply    # applique réellement les changements
 */

require("dotenv").config();
const mongoose = require("mongoose");

require("../models/User");
require("../models/Job");
const Application = require("../models/Application");
const Interview = require("../models/Interview");

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.url_MongoDB);

  const apps = await Application.find()
    .populate("job", "title")
    .populate("candidate", "name")
    .lean();

  const toDelete = [];
  const toPending = [];

  for (const a of apps) {
    const label = `${a.candidate?.name || "(candidat supprimé)"} → ${a.job?.title || "(offre supprimée)"}`;

    if (!a.job) {
      toDelete.push({ id: a._id, label, reason: "offre supprimée" });
      continue;
    }
    if (!a.candidate) {
      toDelete.push({ id: a._id, label, reason: "candidat supprimé" });
      continue;
    }
    if (a.status === "accepted") {
      const iv = await Interview.findOne({ job: a.job._id, candidate: a.candidate._id }).lean();
      if (!iv) {
        toPending.push({ id: a._id, label, reason: "entretien supprimé" });
      }
    }
  }

  console.log(`\n${APPLY ? "=== APPLICATION DES CHANGEMENTS ===" : "=== DRY-RUN (aucune écriture) ==="}`);
  console.log(`Candidatures analysées : ${apps.length}\n`);

  console.log(`À SUPPRIMER (${toDelete.length}) :`);
  toDelete.forEach((x) => console.log(`  - ${x.label.padEnd(48)} [${x.reason}]`));
  if (!toDelete.length) console.log("  (aucune)");

  console.log(`\nÀ REPASSER EN "pending" (${toPending.length}) :`);
  toPending.forEach((x) => console.log(`  - ${x.label.padEnd(48)} [${x.reason}]`));
  if (!toPending.length) console.log("  (aucune)");

  if (APPLY) {
    if (toDelete.length) {
      await Application.deleteMany({ _id: { $in: toDelete.map((x) => x.id) } });
    }
    if (toPending.length) {
      await Application.updateMany(
        { _id: { $in: toPending.map((x) => x.id) } },
        { $set: { status: "pending" } }
      );
    }
    console.log(`\n✔ Terminé : ${toDelete.length} supprimée(s), ${toPending.length} repassée(s) en "pending".`);
  } else {
    console.log("\nRelancer avec --apply pour appliquer ces changements.");
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
