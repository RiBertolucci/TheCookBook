const assert = require('node:assert/strict');
const familiesService = require('../../../../backend/src/services/ingredient-families.service');

function testBuildFamilyGrouping() {
  const snapshot = {
    name: 'ingredients-catalog',
    entries: {
      'Ingredients/verdure/patata/patata-novella.md': ['patata novella'],
      'Ingredients/verdure/patata/patata-gialla.md': ['patata gialla'],
      'Ingredients/verdure/patata.md': ['patata'],
      'Ingredients/verdure/carota.md': ['carota'],
      'Recipes/pasta.md': ['pasta']
    }
  };

  const result = familiesService.buildIngredientFamiliesFromSnapshot(snapshot);
  const patata = result.families.find((family) => family.key === 'patata');

  assert.ok(patata);
  assert.equal(patata.hasExactFile, true);
  assert.equal(patata.isFamily, true);
  assert.deepEqual(
    patata.variants.map((variant) => variant.path),
    [
      'verdure/patata/patata-gialla.md',
      'verdure/patata/patata-novella.md'
    ]
  );
}

function testFindFamilyByNameWithExactFileOnly() {
  const snapshot = {
    name: 'ingredients-catalog',
    entries: {
      'Ingredients/verdure/melanzana.md': ['melanzana']
    }
  };

  const result = familiesService.findIngredientFamilyByName(snapshot, 'Melanzana');

  assert.ok(result);
  assert.equal(result.key, 'melanzana');
  assert.equal(result.isFamily, false);
  assert.equal(result.hasExactFile, true);
  assert.deepEqual(result.variants, []);
}

function testHyphenatedNamesNormalization() {
  const snapshot = {
    name: 'ingredients-catalog',
    entries: {
      'Ingredients/spezie/pepe-nero/pepe-nero-del-sarawak.md': ['pepe nero del sarawak'],
      'Ingredients/spezie/pepe-nero/pepe-nero-di-kampot.md': ['pepe nero di kampot']
    }
  };

  const result = familiesService.buildIngredientFamiliesFromSnapshot(snapshot);
  const family = result.families.find((item) => item.key === 'pepe nero');

  assert.ok(family);
  assert.equal(family.label, 'Pepe Nero');
  assert.equal(family.hasExactFile, false);
  assert.deepEqual(
    family.variants.map((variant) => variant.label),
    ['Pepe Nero Del Sarawak', 'Pepe Nero Di Kampot']
  );
}

(function run() {
  testBuildFamilyGrouping();
  testFindFamilyByNameWithExactFileOnly();
  testHyphenatedNamesNormalization();
  // eslint-disable-next-line no-console
  console.log('ingredient-families resolver tests passed');
})();
