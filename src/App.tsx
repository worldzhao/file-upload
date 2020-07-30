import React, { useState } from "react";
import axios from "axios";
import { useImmer } from "use-immer";

import { Progress } from "antd";

import "antd/es/progress/style/css";
import "./App.css";

interface ChunkData {
  chunk: Blob;
  hash: string;
  index: number;
  loaded: number;
}

function App() {
  const [fileData, setFileData] = useState<File | null>(null);
  const [chunksData, setChunkData] = useImmer<ChunkData[] | null>(null);

  // 监听input事件获取文件
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files === null) return;
    const file = e.target.files[0];
    setFileData(file);
    uploadFile(file);
  };

  // 上传文件
  const uploadFile = async (file: File) => {
    const chunks = createChunks(file);
    const chunksWithHash = chunks.map(({ file: chunk }, index) => ({
      chunk: chunk,
      hash: `${file.name}-${index}`,
      index,
      loaded: 0,
    }));
    setChunkData(() => chunksWithHash);
    await uploadChunks(chunksWithHash, file);
    await notify2Merge(file);
  };

  // 上传切片
  const uploadChunks = (chunksWithHash: ChunkData[], file: File) => {
    const parallelPromises = chunksWithHash
      .map(({ chunk, hash, index }) => {
        const fd = new FormData();
        fd.append("chunk", chunk);
        fd.append("hash", hash);
        fd.append("filename", file.name);
        return { fd, index };
      })
      .map(({ fd, index }) =>
        axios.request({
          method: "post",
          url: "http://localhost:3001/upload-chunk",
          data: fd,
          onUploadProgress: (e) => {
            setChunkData((draft) => {
              if (Array.isArray(draft)) {
                draft[index].loaded = e.loaded;
              }
            });
          },
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

  let percentage = 0;

  if (Array.isArray(chunksData) && chunksData.length > 0 && fileData) {
    const loaded = chunksData.reduce((accu, curr) => {
      const { loaded } = curr;
      accu += loaded;
      return accu;
    }, 0);
    percentage = Number(((loaded / fileData.size) * 100).toFixed(0));
  }

  return (
    <div className="App">
      <input type="file" onChange={onFileInputChange} />
      <br />
      <Progress percent={percentage}></Progress>
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
