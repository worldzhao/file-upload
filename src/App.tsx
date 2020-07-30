import React, { useState } from "react";
import axios from "axios";

import "antd/es/button/style/css";
import "./App.css";

function App() {
  // const [file, setFile] = useState<File | null>(null);

  // 监听input事件获取文件
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files === null) return;
    const file = e.target.files[0];
    // setFile(file);
    uploadFile(file);
  };

  // 上传文件
  const uploadFile = async (file: File) => {
    const chunks = createChunks(file);
    const chunksWithHash = chunks.map(({ file: chunk }, index) => ({
      chunk: chunk,
      hash: `${file.name}-${index}`,
    }));
    await uploadChunks(chunksWithHash, file);
    await notify2Merge(file);
  };

  // 上传切片
  const uploadChunks = (
    chunksWithHash: { chunk: Blob; hash: string }[],
    file: File
  ) => {
    const parallelPromises = chunksWithHash
      .map(({ chunk, hash }) => {
        const fd = new FormData();
        fd.append("chunk", chunk);
        fd.append("hash", hash);
        fd.append("filename", file.name);
        return fd;
      })
      .map((fd) =>
        axios.request({
          method: "post",
          url: "http://localhost:3001/upload-chunk",
          data: fd,
        })
      );

    return Promise.all(parallelPromises);
  };

  // 通知后端合并切片
  const notify2Merge = (file: File) => {
    return axios.request({
      method: "get",
      url: "http://localhost:3001/merge",
      params: { filename: file.name, size: SIZE },
    });
  };

  return (
    <div className="App">
      <input type="file" onChange={onFileInputChange} />
    </div>
  );
}

export default App;

const SIZE = 10 * 1024 * 1024; // 切片大小

// 生成分片
function createChunks(file: File, size = SIZE) {
  const chunks = [];
  let cur = 0;
  while (cur < file.size) {
    chunks.push({ file: file.slice(cur, cur + size) });
    cur += size;
  }
  return chunks;
}
