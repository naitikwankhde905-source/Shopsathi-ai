let cachedToken = null;
let tokenExpiresAt = 0;

async function getAmazonToken(){

  if(
    cachedToken &&
    Date.now() < tokenExpiresAt
  ){
    return cachedToken;
  }

  const clientId =
    process.env.AMAZON_CLIENT_ID;

  const clientSecret =
    process.env.AMAZON_CLIENT_SECRET;

  const version =
    process.env.AMAZON_CREDENTIAL_VERSION || "3.2";

  if(!clientId || !clientSecret){
    throw new Error(
      "Amazon Creators API credentials are missing."
    );
  }

  let tokenEndpoint =
    "https://api.amazon.co.uk/auth/o2/token";

  if(version.startsWith("3.1")){
    tokenEndpoint =
      "https://api.amazon.com/auth/o2/token";
  }

  if(version.startsWith("3.3")){
    tokenEndpoint =
      "https://api.amazon.co.jp/auth/o2/token";
  }

  const response =
    await fetch(
      tokenEndpoint,
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:JSON.stringify({
          grant_type:
            "client_credentials",

          client_id:
            clientId,

          client_secret:
            clientSecret,

          scope:
            "creatorsapi::default"
        })
      }
    );

  const data =
    await response.json();

  if(!response.ok){

    console.error(
      "Amazon token error:",
      data
    );

    throw new Error(
      data?.error_description ||
      data?.error ||
      "Amazon authentication failed."
    );
  }

  cachedToken =
    data.access_token;

  tokenExpiresAt =
    Date.now() +
    ((data.expires_in || 3600) - 120) * 1000;

  return cachedToken;
}


export default async function handler(req,res){

  if(req.method !== "GET"){
    return res.status(405).json({
      error:"Method not allowed"
    });
  }

  try{

    const query =
      String(
        req.query.q || ""
      ).trim();

    if(!query){

      return res.status(400).json({
        error:
          "Product search query is required."
      });

    }

    const partnerTag =
      process.env.AMAZON_PARTNER_TAG;

    if(!partnerTag){

      return res.status(500).json({
        error:
          "AMAZON_PARTNER_TAG is missing in Vercel."
      });

    }

    const token =
      await getAmazonToken();

    const marketplace =
      "www.amazon.in";

    const payload = {

      keywords: query,

      searchIndex: "All",

      itemCount: 10,

      availability: "Available",

      condition: "New",

      marketplace,

      partnerTag,

      sortBy: "Relevance",

      resources: [

        "images.primary.large",

        "itemInfo.title",

        "itemInfo.byLineInfo",

        "offersV2.listings.price",

        "offersV2.listings.availability",

        "offersV2.listings.condition"

      ]

    };

    const response =
      await fetch(
        "https://creatorsapi.amazon/catalog/v1/searchItems",
        {
          method:"POST",

          headers:{

            "Authorization":
              `Bearer ${token}`,

            "Content-Type":
              "application/json",

            "x-marketplace":
              marketplace

          },

          body:
            JSON.stringify(payload)

        }
      );

    const data =
      await response.json();

    if(!response.ok){

      console.error(
        "Amazon API error:",
        data
      );

      return res.status(
        response.status
      ).json({
        error:
          data?.message ||
          data?.errors?.[0]?.message ||
          "Amazon product search failed."
      });

    }

    const items =
      data?.searchResult?.items || [];

    const products =
      items.map(item => {

        const listing =
          item?.offersV2
          ?.listings?.[0];

        const money =
          listing?.price?.money;

        return {

          asin:
            item.asin || "",

          title:
            item?.itemInfo
            ?.title
            ?.displayValue ||
            "Amazon Product",

          image:
            item?.images
            ?.primary
            ?.large
            ?.url ||
            item?.images
            ?.primary
            ?.medium
            ?.url ||
            "",

          price:
            money?.amount ?? null,

          displayPrice:
            money?.displayAmount ||
            (
              money?.amount != null
                ? `₹${money.amount}`
                : "See Amazon"
            ),

          currency:
            money?.currency ||
            "INR",

          url:
            item.detailPageURL ||
            `https://www.amazon.in/dp/${item.asin}?tag=${encodeURIComponent(partnerTag)}`,

          availability:
            listing
            ?.availability
            ?.type ||
            "",

          condition:
            listing
            ?.condition
            ?.value ||
            ""

        };

      });

    return res.status(200).json({

      success:true,

      query,

      products

    });

  }catch(error){

    console.error(error);

    return res.status(500).json({

      error:
        error.message ||
        "Amazon service failed."

    });

  }

}
