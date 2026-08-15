import amazonPaapi from "amazon-paapi";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({
      error: "Search query is required"
    });
  }

  if (
    !process.env.AMAZON_ACCESS_KEY ||
    !process.env.AMAZON_SECRET_KEY ||
    !process.env.AMAZON_PARTNER_TAG
  ) {
    return res.status(500).json({
      error:
        "Amazon API credentials are missing in Vercel Environment Variables."
    });
  }

  try {
    const commonParameters = {
      AccessKey: process.env.AMAZON_ACCESS_KEY,
      SecretKey: process.env.AMAZON_SECRET_KEY,
      PartnerTag: process.env.AMAZON_PARTNER_TAG,
      PartnerType: "Associates",
      Marketplace: "www.amazon.in"
    };

    const requestParameters = {
      Keywords: query,
      SearchIndex: "All",
      ItemCount: 10,

      Resources: [
        "Images.Primary.Large",
        "ItemInfo.Title",
        "OffersV2.Listings.Price",
        "CustomerReviews.Count",
        "CustomerReviews.StarRating"
      ]
    };

    const data = await amazonPaapi.SearchItemsV2(
      commonParameters,
      requestParameters
    );

    const items = data?.SearchResult?.Items || [];

    const products = items.map((item) => {
      const title =
        item?.ItemInfo?.Title?.DisplayValue ||
        "Amazon Product";

      const image =
        item?.Images?.Primary?.Large?.URL ||
        "";

      const price =
        item?.OffersV2?.Listings?.[0]?.Price?.Money?.Amount ??
        null;

      const currency =
        item?.OffersV2?.Listings?.[0]?.Price?.Money?.Currency ||
        "INR";

      const rating =
        item?.CustomerReviews?.StarRating ||
        null;

      const reviews =
        item?.CustomerReviews?.Count ||
        0;

      return {
        asin: item?.ASIN || "",
        title,
        image,
        price,
        currency,
        rating,
        reviews,
        url:
          item?.DetailPageURL ||
          `https://www.amazon.in/dp/${item?.ASIN}`
      };
    });

    return res.status(200).json({
      success: true,
      products
    });

  } catch (error) {
    console.error("Amazon API Error:", error);

    return res.status(500).json({  
      error: "Amazon product search failed.",
      details: error?.message || "Unknown error"
    });
  }
}
2.package.json
{
  "name": "shopsathi",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vercel dev",
    "start": "vercel dev"
  },
  "dependencies": {
    "amazon-paapi": "^1.1.0"
  }
}
