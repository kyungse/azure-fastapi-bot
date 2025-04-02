// ✅ 공통 상태 클래스
function getStatusClass(status) {
	status = status.toLowerCase();
	if (status.includes('running')) return 'succeeded';
	if (status.includes('stopped') || status.includes('deallocated')) return 'failed';
	if (status.includes('starting')) return 'updating';
	if (status.includes('stopping')) return 'deleting';
	return 'unknown';
}

// ✅ 리소스 그룹 조회
async function fetchResourceGroups() {
	const res = await fetch('/api/resource-groups');
	const data = await res.json();
	const groups = data.resource_groups;
	const list = document.getElementById('resource-groups-list');
	list.innerHTML = '';
	groups.forEach(group => {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="item-content">
				<span class="item-name">${group.name}</span>
				<span class="item-location">${group.location}</span>
				<span class="item-status ${group.provisioning_state.toLowerCase()}">${group.provisioning_state}</span>
			</div>
		`;
		list.appendChild(li);
	});
}

// ✅ 리소스 그룹 내 VM 조회
async function fetchVMsInGroup() {
	const group = document.getElementById('vm-group-input').value;
	if (!group) {
		alert('리소스 그룹 이름을 입력해주세요.');
		return;
	}

	try {
		const res = await fetch(`/api/resource-groups/${group}/vms`);
		const data = await res.json();
		const vms = data.vms;
		const list = document.getElementById('vm-list');
		list.innerHTML = '';

		if (!vms || vms.length === 0) {
			list.innerHTML = '<li><div class="item-content">VM이 없습니다.</div></li>';
			return;
		}

		vms.forEach(vm => {
			const li = document.createElement('li');
			li.innerHTML = `
				<div class="item-content">
					<div class="item-info">
						<span class="item-name">${vm.name}</span>
					</div>
					<span class="item-status ${getStatusClass(vm.status)}">${vm.status}</span>
				</div>
			`;
			list.appendChild(li);
		});
	} catch (error) {
		console.error('Error:', error);
		alert('VM 목록을 가져오는데 실패했습니다.');
	}
}

// ✅ VM 상세 정보
async function fetchVMDetails() {
	const group = document.getElementById('vm-detail-group').value;
	const vm = document.getElementById('vm-name-input').value;

	if (!group || !vm) {
		alert('리소스 그룹 이름과 VM 이름을 모두 입력해주세요.');
		return;
	}

	try {
		const res = await fetch(`/api/resource-groups/${group}/vms/${vm}`);
		if (!res.ok) throw new Error('VM 정보를 가져오는데 실패했습니다.');
		const detail = await res.json();
		const detailDisplay = document.getElementById('vm-detail-display');

		detailDisplay.innerHTML = `
			<div class="vm-detail-list">
				<div class="detail-item"><span class="detail-label">이름</span><span class="detail-value">${detail.name}</span></div>
				<div class="detail-item"><span class="detail-label">OS 타입</span><span class="detail-value">${detail.os_type}</span></div>
				<div class="detail-item"><span class="detail-label">크기</span><span class="detail-value">${detail.size}</span></div>
				<div class="detail-item"><span class="detail-label">상태</span><span class="detail-value item-status ${getStatusClass(detail.status)}">${detail.status}</span></div>
			</div>
		`;
	} catch (error) {
		console.error('Error:', error);
		document.getElementById('vm-detail-display').innerHTML = `<div class="error-message">VM 정보를 가져오는데 실패했습니다.</div>`;
	}
}

// ✅ ACR 레포지토리 목록 조회
async function fetchACRImages() {
	const registry = document.getElementById('acr-name-input').value;
	const res = await fetch(`/api/acr/${registry}/repositories`);
	const data = await res.json();
	const repositories = data.repositories;
	const list = document.getElementById('acr-image-list');
	list.innerHTML = '';

	for (const repo of repositories) {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="item-content">
				<div class="item-info">
					<span class="item-name">${repo}</span>
				</div>
				<button class="secondary-button small" onclick="handleTagView('${registry}', '${repo}')">
					<span>태그 보기</span>
				</button>
			</div>
		`;
		list.appendChild(li);
	}
}

// ✅ handleTagView: 입력창 채우고 fetchACRTagsFromInput 호출
function handleTagView(registry, repo) {
	document.getElementById('tag-acr-input').value = registry;
	document.getElementById('tag-repo-input').value = repo;
	fetchACRTagsFromInput();
}

// ✅ 아래쪽 태그 정보 섹션의 태그 목록 불러오기 (공통 함수)
async function fetchACRTagsFromInput() {
	const registry = document.getElementById('tag-acr-input').value;
	const repository = document.getElementById('tag-repo-input').value;

	if (!registry || !repository) {
		alert('ACR 이름과 레포지토리 이름을 모두 입력해주세요.');
		return;
	}

	try {
		const res = await fetch(`/api/acr/${registry}/repositories/${repository}/tags`);
		const data = await res.json();
		const tags = data.tags;
		const list = document.getElementById('tag-list');
		list.innerHTML = '';

		if (!tags || tags.length === 0) {
			list.innerHTML = `<li><div class="tag-empty">태그가 없습니다.</div></li>`;
			return;
		}

		const header = document.createElement('li');
		header.className = 'tag-header';
		header.innerHTML = `
			<div class="tag-row">
				<div class="tag-column tag-name-column">태그명</div>
				<div class="tag-column tag-date-column">생성일</div>
			</div>
		`;
		list.appendChild(header);

		tags.forEach(tag => {
			const li = document.createElement('li');
			li.className = 'tag-item';
			li.innerHTML = `
				<div class="tag-row">
					<div class="tag-column tag-name-column">
						<span class="tag-badge">${tag.name}</span>
					</div>
					<div class="tag-column tag-date-column">${tag.created_on}</div>
				</div>
			`;
			list.appendChild(li);
		});
	} catch (error) {
		console.error('Error:', error);
		document.getElementById('tag-list').innerHTML = `<li><div class="tag-error">태그 정보를 가져오는데 실패했습니다.</div></li>`;
	}
}

async function fetchACRList() {
	try {
		const res = await fetch('/api/acr');
		const data = await res.json();
		const registries = data.registries;
		const list = document.getElementById('acr-list');
		list.innerHTML = '';

		if (!registries || registries.length === 0) {
			list.innerHTML = '<li><div class="item-content">ACR이 없습니다.</div></li>';
			return;
		}

		registries.forEach(acr => {
			const li = document.createElement('li');
			li.innerHTML = `
				<div class="item-content">
					<div class="item-info">
						<span class="item-name">${acr.name}</span>
						<span class="item-location">${acr.location}</span>
					</div>
					<span class="item-status succeeded">${acr.sku}</span>
				</div>
			`;
			list.appendChild(li);
		});
	} catch (error) {
		console.error('Error fetching ACR list:', error);
		const list = document.getElementById('acr-list');
		list.innerHTML = `<li><div class="item-content">ACR 목록을 가져오는데 실패했습니다.</div></li>`;
	}
}
