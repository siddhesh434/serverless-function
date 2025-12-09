import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);

const NAMESPACE = "argo";

// Create a reusable WorkflowTemplate
function createWorkflowTemplateSpec(templateName: string, imageName: string) {
  return {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "WorkflowTemplate",
    metadata: {
      name: templateName,
      labels: {
        "serverless-runner": "true",
        "image": imageName.replace(/[^a-zA-Z0-9-]/g, "-").substring(0, 63),
      }
    },
    spec: {
      entrypoint: "main",
      arguments: {
        parameters: [
          { name: "args", value: "[]" }
        ]
      },
      templates: [{
        name: "main",
        inputs: {
          parameters: [
            { name: "args" }
          ]
        },
        container: {
          image: imageName,
          command: ["sh", "-c"],
          args: ["pixi run run {{inputs.parameters.args}}"]
        },
      }],
    },
  };
}

// Create a Workflow that references a WorkflowTemplate
function createWorkflowFromTemplate(templateName: string, args: string[]) {
  const argsString = args.join(" ");
  return {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Workflow",
    metadata: {
      generateName: `${templateName}-run-`,
    },
    spec: {
      workflowTemplateRef: {
        name: templateName,
      },
      arguments: {
        parameters: [
          { name: "args", value: argsString }
        ]
      }
    },
  };
}



async function createWorkflowTemplate(templateName: string, imageName: string) {
  const template = createWorkflowTemplateSpec(templateName, imageName);

  // Check if template already exists, if so delete it first
  try {
    await customApi.getNamespacedCustomObject({
      group: "argoproj.io",
      version: "v1alpha1",
      namespace: NAMESPACE,
      plural: "workflowtemplates",
      name: templateName,
    });
    // Template exists, delete it
    await customApi.deleteNamespacedCustomObject({
      group: "argoproj.io",
      version: "v1alpha1",
      namespace: NAMESPACE,
      plural: "workflowtemplates",
      name: templateName,
    });
  } catch (e: any) {
    // Template doesn't exist, that's fine
  }

  const res = await customApi.createNamespacedCustomObject({
    group: "argoproj.io",
    version: "v1alpha1",
    namespace: NAMESPACE,
    plural: "workflowtemplates",
    body: template,
  });
  return res;
}

async function submitWorkflowFromTemplate(templateName: string, args: string[]) {
  const workflow = createWorkflowFromTemplate(templateName, args);
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



async function deleteWorkflowTemplate(name: string) {
  const res = await customApi.deleteNamespacedCustomObject({
    group: "argoproj.io",
    version: "v1alpha1",
    namespace: NAMESPACE,
    plural: "workflowtemplates",
    name: name,
  });
  return res;
}

async function getPodLogs(podName: string): Promise<string> {
  const res = await coreApi.readNamespacedPodLog({
    name: podName,
    namespace: NAMESPACE,
    container: "main",
  });
  return res || "";
}

export {
  submitWorkflowFromTemplate,
  createWorkflowTemplate,
  getWorkflowStatus,
  getPodLogs,
  deleteWorkflowTemplate,
};
