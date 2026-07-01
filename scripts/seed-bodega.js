'use strict';

const compactMediaUrl = (media) => {
  if (!media) {
    return null;
  }

  const file = Array.isArray(media) ? media[0] : media;

  return file?.formats?.thumbnail?.url || file?.url || null;
};

const toInteger = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0;
};

const buildBodegaSeedData = (variant) => {
  const product = variant.product || {};
  const category = product.category || null;
  const price = toInteger(variant.price);
  const variantDocumentId = variant.documentId || String(variant.id);
  const imageUrl = compactMediaUrl(variant.image) || compactMediaUrl(product.images);
  const data = {
    bodegaName: variant.variantName || product.productName || 'Sin nombre',
    variantDocumentId,
    productDocumentId: product.documentId,
    categoryDocumentId: category?.documentId,
    variantNameSnapshot: variant.variantName || 'Sin nombre',
    productNameSnapshot: product.productName || '',
    categoryNameSnapshot: category?.categoryName || '',
    imageUrlSnapshot: imageUrl,
    materialGrams: 0,
    printTimeHours: 0,
    printTimeLabel: '',
    materialCost: 0,
    lightCost: 0,
    boxCost: 0,
    paintCost: 0,
    totalCost: 0,
    price,
    returnAmount: price,
    variant: variant.id,
  };

  if (product.id) {
    data.product = product.id;
  }

  if (category?.id) {
    data.category = category.id;
  }

  return data;
};

async function seedBodega() {
  const variants = await strapi.db.query('api::variant.variant').findMany({
    limit: 1000,
    orderBy: [{ variantName: 'asc' }],
    populate: {
      image: true,
      product: {
        populate: {
          category: true,
          images: true,
        },
      },
    },
  });
  let created = 0;
  let skipped = 0;

  for (const variant of variants) {
    const variantDocumentId = variant.documentId || String(variant.id);
    const existingBodega = await strapi.db.query('api::bodega.bodega').findOne({
      where: { variantDocumentId },
    });

    if (existingBodega) {
      skipped += 1;
      continue;
    }

    await strapi.db.query('api::bodega.bodega').create({
      data: buildBodegaSeedData(variant),
    });
    created += 1;
  }

  console.log(`Bodega seed listo. Variantes encontradas: ${variants.length}. Creadas: ${created}. Existentes: ${skipped}.`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedBodega();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
