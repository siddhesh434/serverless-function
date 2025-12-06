import Docker from "dockerode";
import fs from "fs";
import tar from "tar-fs";
import os from "os";
import path from "path";

const docker = new Docker();

function getAuthConfig() {
  const configPath = path.join(os.homedir(), ".docker", "config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const auth = config.auths?.["https://index.docker.io/v1/"]?.auth;
    if (auth) {
      const decoded = Buffer.from(auth, "base64").toString();
      const [username, password] = decoded.split(":");
      return { username, password, serveraddress: "https://index.docker.io/v1/" };
    }
  }
  return {};
}

function generateWrapper(userCode: string): string {
  return `import sys
import json

${userCode}

if __name__ == "__main__":
    args = sys.argv[1:]
    parsed = [int(a) if a.isdigit() else a for a in args]
    result = handler(*parsed)
    print(json.dumps({"result": result}))
`;
}

function generateDockerfile(): string {
  return `FROM ubuntu:24.04
RUN apt-get update && apt-get install -y curl && \\
    curl -fsSL https://pixi.sh/install.sh | bash && \\
    rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.pixi/bin:$PATH"
WORKDIR /app
COPY pixi.toml handler.py ./
RUN pixi install
ENTRYPOINT ["pixi", "run", "run"]`;
}

function generatePixiToml(userPixi: string): string {
  if (!userPixi.includes("[tasks]")) {
    return userPixi + `\n[tasks]\nrun = "python handler.py"`;
  }
  return userPixi;
}

async function prepareBuildContext(code: string, pixi: string): Promise<string> {
  const dir = `/tmp/build-${Date.now()}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/handler.py`, generateWrapper(code));
  fs.writeFileSync(`${dir}/pixi.toml`, generatePixiToml(pixi));
  fs.writeFileSync(`${dir}/Dockerfile`, generateDockerfile());
  return dir;
}

async function buildImage(code: string, pixi: string, tag: string, onLog: (log: string) => void): Promise<void> {
  const dir = await prepareBuildContext(code, pixi);
  const tarStream = tar.pack(dir);
  const stream = await docker.buildImage(tarStream, { t: tag });
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve(), (event) => {
      if (event.stream) onLog(event.stream.trim());
    });
  });
}

async function pushImage(tag: string, onLog: (log: string) => void): Promise<void> {
  const image = docker.getImage(tag);
  const authconfig = getAuthConfig();
  const stream = await image.push({ authconfig });
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve(), (event) => {
      if (event.status) onLog(event.status);
    });
  });
}

export { buildImage, pushImage };
