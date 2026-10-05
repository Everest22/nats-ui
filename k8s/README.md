# Kubernetes Deployment

## 1. Update images

In `backend-deployment.yaml` and `frontend-deployment.yaml`, replace `<image_name>` with the original image from Artifact Hub.

## 2. Create namespace

```bash
kubectl apply -f namespace.yaml
```

## 3. Create image pull secret

Create the secret with the same name used in `imagePullSecrets` of the deployment files.

```bash
kubectl create secret docker-registry registry-secret \
  --docker-server=<registry-url> \
  --docker-username=<username> \
  --docker-password=<password> \
  -n nats
```

## 4. Apply files in this order

```bash
kubectl apply -f backend-pvc.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f frontend-configmap.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
```

## 5. Check

```bash
kubectl get pods,svc -n nats
```
