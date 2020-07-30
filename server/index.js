const path = require("path");
const fs = require("fs-extra");
const Koa = require("koa");
const cors = require("@koa/cors");
const Router = require("@koa/router");
const koaBody = require("koa-body");
const koaStatic = require("koa-static");

const app = new Koa();
const router = new Router();

const uploadDir = path.resolve(__dirname, "./public/uploads");

app.use(koaStatic(path.resolve(__dirname, "./public")));

app.use(
  koaBody({
    // 支持文件格式
    multipart: true,
    formidable: {
      // 上传目录
      uploadDir,
      // 保留文件扩展名
      keepExtensions: true,
    },
  })
);

// 上传切片接口
router.post("/upload-chunk", (ctx, next) => {
  // 如果切片目录不存在 创建切片目录
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  const { hash, filename } = ctx.request.body;
  const { chunk } = ctx.request.files;
  const chunkDir = path.resolve(uploadDir, `${filename}_temp`);

  // 如果切片目录不存在 创建切片目录
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir);
  }

  fs.moveSync(chunk.path, `${chunkDir}/${hash}`);

  // 将切片移动至切片目录
  ctx.body = {
    code: 0,
    msg: "上传成功",
    data: null,
  };
});

// 合并接口
router.get("/merge", async (ctx, next) => {
  const { filename, size } = ctx.request.query;
  const filePath = path.resolve(uploadDir, filename);
  await mergeChunks(filePath, filename, size);
  ctx.body = {
    code: 0,
    msg: "合并成功",
    data: `${ctx.origin}/uploads/${filename}`,
  };
});

app.use(cors()).use(router.routes()).use(router.allowedMethods());

app.listen(3001);

console.log("node server in listening at port 3001");

// 合并切片
async function mergeChunks(filePath, filename, size) {
  const chunkDir = path.resolve(uploadDir, `${filename}_temp`);
  const chunkPaths = fs.readdirSync(chunkDir);

  // 根据切片下标进行排序
  chunkPaths.sort((a, b) => a.slice(-1)[0] - b.slice(-1)[0]);

  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        fs.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size,
        })
      )
    )
  );
  fs.rmdirSync(chunkDir);
}

const pipeStream = (path, writeStream) =>
  new Promise((resolve) => {
    const readStream = fs.createReadStream(path);
    readStream.on("end", () => {
      fs.unlinkSync(path);
      resolve();
    });
    readStream.pipe(writeStream);
  });
