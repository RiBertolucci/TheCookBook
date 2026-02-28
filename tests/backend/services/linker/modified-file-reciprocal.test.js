(async () => {
  const fs = require('fs').promises;
  const os = require('os');
  const path = require('path');
  const linker = require(path.resolve(__dirname, '../../../../backend/src/services/linker'));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cookbook-linker-mod-'));
  const root = path.join(tmp, 'content');

  await fs.mkdir(path.join(root, 'Ingredients', 'Mediterranei'), { recursive: true });
  await fs.mkdir(path.join(root, 'SpicesAndHerbs'), { recursive: true });

  await fs.writeFile(path.join(root, 'Ingredients', 'onion.md'), `# Onion\n\n## Goes with ingredients\n- Carrot\n\n## Goes with spicesAndHerbs\n- Basil\n`);
  await fs.writeFile(path.join(root, 'Ingredients', 'carrot.md'), `# Carrot\n\n## Goes with ingredients\n- Onion\n\n## Goes with spicesAndHerbs\n- Oregano\n`);
  await fs.writeFile(path.join(root, 'SpicesAndHerbs', 'basil.md'), `# Basil\n\n## Mixes Well With\n- Oregano\n\n## Good With Ingredients\n- Onion\n`);

  const celeryPath = path.join(root, 'Ingredients', 'Mediterranei', 'celery.md');
  await fs.writeFile(celeryPath, `# Celery\n\n## Goes with ingredients\n- Onion\n\n## Goes with spicesAndHerbs\n- Basil\n`);

  await linker.processModifiedFile(celeryPath, root);

  const onionAfter = await fs.readFile(path.join(root, 'Ingredients', 'onion.md'), 'utf8');
  const basilAfter = await fs.readFile(path.join(root, 'SpicesAndHerbs', 'basil.md'), 'utf8');

  const assertions = {
    ingredientBacklinkAdded: onionAfter.includes('[Celery](/api/ingredients/Mediterranei/celery.md)'),
    spiceBacklinkAdded: basilAfter.includes('[Celery](/api/ingredients/Mediterranei/celery.md)'),
  };

  console.log(assertions);

  if (!Object.values(assertions).every(Boolean)) {
    process.exit(1);
  }
})();
