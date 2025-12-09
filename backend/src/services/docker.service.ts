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
    try:
        args = sys.argv[1:]
        parsed = [int(a) if a.isdigit() else a for a in args]
        result = handler(*parsed)
        print(json.dumps({"result": result}))
    except NameError as e:
        print(json.dumps({"error": "handler function not defined"}))
    except TypeError as e:
        print(json.dumps({"error": f"Argument error: {e}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
`;
}

function generateDockerfile(envVars: Record<string, string> = {}): string {
  const envLines = Object.entries(envVars)
    .map(([k, v]) => `ENV ${k}="${v}"`)
    .join("\n");

  return `
FROM python:3.12-slim

# Install curl (required for Pixi)
RUN apt-get update && apt-get install -y curl && \\
    curl -fsSL https://pixi.sh/install.sh | bash && \\
    rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.pixi/bin:$PATH"

${envLines}

WORKDIR /app
COPY . .

# Install dependencies defined in pixi.toml
RUN pixi install

ENTRYPOINT ["pixi", "run", "run"]
`;
}


function generatePixiToml(userPixi: string): string {
  if (!userPixi.includes("[tasks]")) {
    return userPixi + `\n[tasks]\nrun = "python main.py"`;
  }
  return userPixi;
}

async function prepareBuildContext(
  files: Record<string, string>,
  pixi: string,
  envVars: Record<string, string> = {}
): Promise<string> {
  const dir = `/tmp/build-${Date.now()}`;
  fs.mkdirSync(dir, { recursive: true });

  // Write all user files
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(dir, filename);
    const fileDir = path.dirname(filePath);
    if (fileDir !== dir) fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, filename === "main.py" ? generateWrapper(content) : content);
  }

  // Ensure main.py exists
  if (!files["main.py"]) {
    fs.writeFileSync(`${dir}/main.py`, generateWrapper('def handler(*args):\n    return "No handler"'));
  }

  fs.writeFileSync(`${dir}/pixi.toml`, generatePixiToml(pixi));
  fs.writeFileSync(`${dir}/Dockerfile`, generateDockerfile(envVars));
  return dir;
}

async function buildImage(
  files: Record<string, string>,
  pixi: string,
  tag: string,
  onLog: (log: string) => void,
  envVars: Record<string, string> = {}
): Promise<void> {
  const dir = await prepareBuildContext(files, pixi, envVars);
  const tarStream = tar.pack(dir);
  const stream = await docker.buildImage(tarStream, { t: tag });
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve(), (event) => {
      if (event.stream) onLog(event.stream.trim());
    });
  });
  fs.rmSync(dir, { recursive: true, force: true });
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

// Keep this function but don't use it during development
// Enable in production for cleanup
async function removeImage(tag: string): Promise<void> {
  try {
    const image = docker.getImage(tag);
    await image.remove({ force: true });
  } catch (e) { }
}

export { buildImage, pushImage, removeImage };
