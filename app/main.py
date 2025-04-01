from fastapi import FastAPI, Request, Depends, HTTPException, Path
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from azure.containerregistry import ContainerRegistryClient
from azure.identity import ClientSecretCredential, DefaultAzureCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.resource import ResourceManagementClient

import os
from pathlib import Path as SysPath
from dotenv import load_dotenv
from datetime import timedelta, timezone

# 📁 경로 설정
BASE_DIR = SysPath(__file__).resolve().parent.parent

# ✅ .env 로드
load_dotenv(dotenv_path=BASE_DIR / ".env")

app = FastAPI()

# 🔧 정적 파일 및 템플릿 디렉토리 설정
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# ✅ Azure 클라이언트 초기화
@app.on_event("startup")
def init_azure_clients():
    subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")

    if not all([subscription_id, tenant_id, client_id, client_secret]):
        raise RuntimeError("환경변수 설정 누락")

    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
    )

    app.state.resource_client = ResourceManagementClient(credential, subscription_id)
    app.state.compute_client = ComputeManagementClient(credential, subscription_id)
    app.state.credential = credential  # ACR 호출용

# 🔄 의존성 주입 함수
def get_resource_client(request: Request):
    return request.app.state.resource_client

def get_compute_client(request: Request):
    return request.app.state.compute_client

def get_credential(request: Request):
    return request.app.state.credential

# ===============================
# 🌐 HTML 라우트
# ===============================
@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# ===============================
# 🧩 API 라우트
# ===============================
@app.get("/api/resource-groups")
def list_resource_groups(resource_client=Depends(get_resource_client)):
    groups = resource_client.resource_groups.list()
    return {
        "resource_groups": [
            {
                "name": g.name,
                "location": g.location,
                "provisioning_state": g.properties.provisioning_state
            } for g in groups
        ]
    }

@app.get("/api/resource-groups/{group}/vms")
def list_vms(
    group: str = Path(..., description="Azure 리소스 그룹 이름"),
    compute_client=Depends(get_compute_client)
):
    vms = compute_client.virtual_machines.list(group)
    vm_list = []
    for vm in vms:
        view = compute_client.virtual_machines.instance_view(group, vm.name)
        status = [s.display_status for s in view.statuses if "PowerState" in s.code]
        vm_list.append({
            "name": vm.name,
            "status": status[0] if status else "Unknown"
        })
    return {"vms": vm_list}

@app.get("/api/resource-groups/{group}/vms/{vm}")
def get_vm(
    group: str = Path(..., description="리소스 그룹 이름"),
    vm: str = Path(..., description="VM 이름"),
    compute_client=Depends(get_compute_client)
):
    vm_obj = compute_client.virtual_machines.get(group, vm)
    view = compute_client.virtual_machines.instance_view(group, vm)
    state = [s.display_status for s in view.statuses if "PowerState" in s.code]
    return {
        "name": vm,
        "os_type": vm_obj.storage_profile.os_disk.os_type,
        "size": vm_obj.hardware_profile.vm_size,
        "status": state[0] if state else "Unknown"
    }

@app.get("/api/acr/{registry}/repositories")
def list_acr_repos(
    registry: str = Path(..., description="ACR 이름"),
):
    url = f"https://{registry}.azurecr.io"
    credential = DefaultAzureCredential()
    client = ContainerRegistryClient(endpoint=url, credential=credential)

    repos = client.list_repository_names()
    return {"registry": registry, "repositories": list(repos)}

@app.get("/api/acr/{registry}/repositories/{repository}/tags")
def list_acr_tags(
    registry: str = Path(..., description="ACR 이름"),
    repository: str = Path(..., description="레포지토리 이름"),
):
    url = f"https://{registry}.azurecr.io"
    credential = DefaultAzureCredential()
    client = ContainerRegistryClient(endpoint=url, credential=credential)

    tags = client.list_tag_properties(repository=repository)
    tag_list = []

    kst = timezone(timedelta(hours=9))
    for tag in tags:
        created = tag.created_on
        created_kst = created.astimezone(kst).strftime("%Y-%m-%d %H:%M:%S KST")
        tag_list.append({
            "name": tag.name,
            "created_on": created_kst
        })

    return {
        "registry": registry,
        "repository": repository,
        "tags": tag_list
    }
