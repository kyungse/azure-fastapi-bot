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

function getStatusClass(status) {
	status = status.toLowerCase();
	if (status.includes('running')) return 'succeeded';
	if (status.includes('stopped') || status.includes('deallocated')) return 'failed';
	if (status.includes('starting')) return 'updating';
	if (status.includes('stopping')) return 'deleting';
	return 'unknown';
}

async function fetchVMDetails() {
	const group = document.getElementById('vm-detail-group').value;
	const vm = document.getElementById('vm-name-input').value;
	
	if (!group || !vm) {
		alert('리소스 그룹 이름과 VM 이름을 모두 입력해주세요.');
		return;
	}

	try {
		const res = await fetch(`/api/resource-groups/${group}/vms/${vm}`);
		if (!res.ok) {
			throw new Error('VM 정보를 가져오는데 실패했습니다.');
		}
		const detail = await res.json();
		const detailDisplay = document.getElementById('vm-detail-display');
		
		detailDisplay.innerHTML = `
			<div class="vm-detail-list">
				<div class="detail-item">
					<span class="detail-label">이름</span>
					<span class="detail-value">${detail.name}</span>
				</div>
				<div class="detail-item">
					<span class="detail-label">OS 타입</span>
					<span class="detail-value">${detail.os_type}</span>
				</div>
				<div class="detail-item">
					<span class="detail-label">크기</span>
					<span class="detail-value">${detail.size}</span>
				</div>
				<div class="detail-item">
					<span class="detail-label">상태</span>
					<span class="detail-value item-status ${getStatusClass(detail.status)}">${detail.status}</span>
				</div>
			</div>
		`;
	} catch (error) {
		console.error('Error:', error);
		document.getElementById('vm-detail-display').innerHTML = `
			<div class="error-message">
				VM 정보를 가져오는데 실패했습니다.
			</div>
		`;
	}
}

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
					<div class="tag-list"></div>
				</div>
				<button class="secondary-button small" onclick="fetchACRTags('${registry}', '${repo}', this)">
					<span>태그 보기</span>
				</button>
			</div>
		`;
		list.appendChild(li);
	}
}

async function fetchACRTags(registry, repository, button) {
	const tagList = button.parentElement.querySelector('.tag-list');
	const res = await fetch(`/api/acr/${registry}/repositories/${repository}/tags`);
	const data = await res.json();
	const tags = data.tags;

	tagList.innerHTML = tags.map(tag => `
		<span class="tag">
			<strong>${tag.name}</strong>
			<small class="tag-date">${tag.created_on}</small>
		</span>
	`).join('');

	document.getElementById('tag-acr-input').value = registry;
	document.getElementById('tag-repo-input').value = repository;

	const tagListDisplay = document.getElementById('tag-list');
	tagListDisplay.innerHTML = '';

	const header = document.createElement('li');
	header.innerHTML = `
		<div class="tag-item tag-header">
			<span class="tag-name">태그</span>
			<span class="tag-date">생성일</span>
		</div>
	`;
	tagListDisplay.appendChild(header);

	if (!tags || tags.length === 0) {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="tag-item">
				<span>태그가 없습니다.</span>
			</div>
		`;
		tagListDisplay.appendChild(li);
		return;
	}

	tags.forEach(tag => {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="tag-item">
				<span class="tag-name">${tag.name}</span>
				<span class="tag-date">${tag.created_on}</span>
			</div>
		`;
		tagListDisplay.appendChild(li);
	});

	button.querySelector('span').textContent = '태그 숨기기';
	button.onclick = () => {
		tagList.innerHTML = '';
		button.querySelector('span').textContent = '태그 보기';
		button.onclick = () => fetchACRTags(registry, repository, button);
	};
}

async function fetchACRTagsFromInput() {
	const registry = document.getElementById('tag-acr-input').value;
	const repository = document.getElementById('tag-repo-input').value;
	
	if (!registry || !repository) {
		alert('ACR 이름과 레포지토리 이름을 모두 입력해주세요.');
		return;
	}

	const res = await fetch(`/api/acr/${registry}/repositories/${repository}/tags`);
	const data = await res.json();
	const tags = data.tags;
	
	const list = document.getElementById('tag-list');
	list.innerHTML = '';

	const header = document.createElement('li');
	header.innerHTML = `
		<div class="tag-item tag-header">
			<span class="tag-name">태그</span>
			<span class="tag-date">생성일</span>
		</div>
	`;
	list.appendChild(header);

	if (!tags || tags.length === 0) {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="tag-item">
				<span>태그가 없습니다.</span>
			</div>
		`;
		list.appendChild(li);
		return;
	}

	tags.forEach(tag => {
		const li = document.createElement('li');
		li.innerHTML = `
			<div class="tag-item">
				<span class="tag-name">${tag.name}</span>
				<span class="tag-date">${tag.created_on}</span>
			</div>
		`;
		list.appendChild(li);
	});
}
