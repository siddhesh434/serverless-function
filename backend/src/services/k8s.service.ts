import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);

const NAMESPACE = "argo";

function createWorkflowSpec(imageName: string, args: string[]) {
  return {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Workflow",
    metadata: { generateName: "func-run-" },
    spec: {
      entrypoint: "main",
      templates: [{
        name: "main",
        container: { image: imageName, args: args },
      }],
    },
  };
}

async function submitWorkflow(imageName: string, args: string[]) {
  const workflow = createWorkflowSpec(imageName, args);
  const res = await customApi.createNamespacedCustomObject({
    group: "argoproj.io",
    version: "v1alpha1",
    namespace: NAMESPACE,
    plural: "workflows",
    body: workflow,
  });
  return res;
}

async function getWorkflowStatus(name: string) {
  const res = await customApi.getNamespacedCustomObject({
    group: "argoproj.io",
    version: "v1alpha1",
    namespace: NAMESPACE,
    plural: "workflows",
    name: name,
  });
  return res as any;
}

async function getPodLogs(podName: string): Promise<string> {
  const res = await coreApi.readNamespacedPodLog({
    name: podName,
    namespace: NAMESPACE,
    container: "main",
  });
  return res || "";
}

export { coreApi, NAMESPACE, submitWorkflow, getWorkflowStatus, getPodLogs };
