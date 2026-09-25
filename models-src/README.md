# models-src

Raw GLBs exported from Blender go here. They stay local (see `.gitignore`); `npm run models` optimises them into `public/models/`, which is committed.

Export checklist and model requirements: docs/PLAN.md, step 0.

`originals/` keeps a model's untouched source when a Blender script writes the version used here
(the pipeline only reads GLBs at this level). `National Costume.glb` is written by
`scripts/blender/patch-national-lining.py` from `originals/National Costume.glb`.
