const axios = require("axios");
const cheerio = require("cheerio");

const baseURL = "https://tubidy.cool";

/**
 * Corrige les URLs relatives / protocol-less
 */
function fixUrl(url) {
  if (!url) return "";

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  if (url.startsWith("http")) {
    return url;
  }

  return baseURL + url;
}

/**
 * 🔍 Recherche Tubidy
 */
async function searchTubidy(query) {
  const { data } = await axios.get(
    baseURL + "/search.php?q=" + encodeURIComponent(query)
  );

  const $ = cheerio.load(data);

  return $(".list-container .media")
    .map((_, el) => ({
      title:
        $(el)
          .find(".media-body a")
          .first()
          .text()
          .trim() || "No Title",

      duration: $(el)
        .find(".mb-text")
        .last()
        .text()
        .replace("Duration: ", "")
        .trim() || "0:00",

      thumbnail: fixUrl($(el).find(".media-left img").attr("src")),

      link: fixUrl($(el).find(".media-body a").first().attr("href")),
    }))
    .get();
}

/**
 * ⬇️ Récupère les liens de téléchargement
 */
async function fetchDownload(url) {
  const { data } = await axios.get(fixUrl(url));
  const $ = cheerio.load(data);

  return $("#donwload_box .list-group-item.big a")
    .map((_, el) => ({
      type: $(el)
        .text()
        .trim()
        .toLowerCase()
        .split(" ")[0],

      size:
        $(el).find(".mb-text").text().trim() || "Unknown",

      link: fixUrl($(el).attr("href")),
    }))
    .get()
    .filter(
      (item, index, arr) =>
        arr.findIndex(
          (x) => x.link === item.link && !item.link.includes("send")
        ) === index
    );
}

/**
 * 📄 Détails + médias
 */
async function getDetail(url) {
  const { data } = await axios.get(fixUrl(url));
  const $ = cheerio.load(data);

  const title =
    $(".video-title-selected")
      .text()
      .replace(/\n/g, " ")
      .trim() || "No Title";

  const duration =
    $(".video-title-selected span")
      .text()
      .replace(/[()]/g, "")
      .trim() || "0:00";

  const thumbnail = fixUrl(
    $(".donwload-box .text-center img").attr("src")
  );

  const downloadPages = $(".video-search-footer li a")
    .map((_, el) => fixUrl($(el).attr("href")))
    .get();

  let media = [];

  for (const page of downloadPages) {
    const links = await fetchDownload(page);
    if (links) media.push(...links);
  }

  // supprimer doublons
  media = media.filter(
    (item, index, arr) =>
      arr.findIndex(
        (x) => x.link === item.link && !item.link.includes("send")
      ) === index
  );

  return {
    title,
    duration,
    thumbnail,
    media,
  };
}

module.exports = {
  searchTubidy,
  getDetail,
};
