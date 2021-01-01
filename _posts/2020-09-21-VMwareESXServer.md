---
layout: post
title: "Memory Resource Management in VMware ESX Server"
categories: "2020"
tags: os virtualization mm
comments: true
---

[VMWare ESX Server](https://www.vmware.com/products/esxi-and-esx.html) is a software layer designed to multiplex hardware resources among virtual machines running unmodified commodity operating systems. ESX Server, different to [VMware Workstation](https://www.vmware.com/products/workstation-pro.html), is a type 1 hypervisor, which means it runs directly on bare metal. ESX Server focuses on running guest VMs without modifying the guest OSes at all, which is challenging.
<!--description-->

> Memory Virtualization is done by interposing an extra abstraction layer between a ```physical address``` from the VM's point of view, and a ```machine address``` which represents the actual hardware memory. ESX Server maintains a *pmap* data structure for each VM to translate PPMs to MPNs. A seperate *shadow page table*, consistent with the physical-to-machine mappings, is used to map virtual-to-machine page mappings. This avoids additional overheads as the hardware TLB will cache direct virtual-to-machine address translations read from the shadow page table.

## Key features

<p align="center"> 
<a href="https://www.vmware.com/pdf/usenix_resource_mgmt.pdf">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/master/posts/ESXServer/ballooning.png" width="70%">
</a>
</p>

**Ballooning** is a technique used by the server to acheive memory reclamation. As its name suggests, the hypervisor inflates the balloon by instructing the balloon driver module to allocate pinned phyiscal pages and deflates it by instructing it to deallocate previously-allocated pages. The idea behind this technique is that the hypervisor is unaware of the specific usage patterns of policies of its guests, therefore the making page replacement decisions is best done in the guest VM. When the hypervisor over commits memory, it needs some way to claim memories from the VMs. By consuming some of the memory that the guest OS believes is physically present in the virtual machine. The guest OS will then swap memory to disk reducing the load on the host's phyiscal memory. The host will them reallocate that memory to other VMs. A details description of ballooning can be found in this [post](https://www.vladan.fr/what-is-vmware-memory-ballooning/).

<p align="center"> 
<a href="https://www.vmware.com/pdf/usenix_resource_mgmt.pdf">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/master/posts/ESXServer/pghash.png" width="70%">
</a>
</p>

> Page Coloring can be used to reduce cache misses or partition resources. But it might comlicates memory management, especially with the presence of huge pages. Because coloring enforeces ownership, thus might result in distinct L2 cache entries.

**Sharing memory**  is achieved by comparing the content of each page, since modifying guest operating system internals is not possible. Because comparing each page would be \\(O(n^2)\\), hasing is used to identify pages to make the progress more efficiently. By letting VMs share pages based the contents, the host can potentially save spaces dramatically. For example, the presence of zero pages is a greate opportunity for page sharing by mapping one zero page to multiple VMs. Hint is hash hit, but it doesn't guarantee the content of the page doesn't change at that moment.

<!-- > Copy-on-write (CoW) -->

**Idle Memory** presents a problem in pure proportional-share algorithms because they do not incorporate any information about active memory usage. More specifically, the memory demand might change dynamically. ESX Server collects *idle memory tax* from VMs to mitigate this issue. A client is charged more for an idle page than the active one. The cost of idle memory is inflated by tax rate. The metrics of idles pages in guests is collected by hypersior without guests' involvement. The idle page information in virtual page table inside VMs is periodically sampled on random bases.

## Questions
a. What is the overhead of ballooning? Triggering memory management in the VM by "tricking" it into thinking the the memory resource is scarce/plentiful may have unexpected behaviors.  
b. Do content-based sharing pose secrutiy vulnerabilities?  
c. Remapping hot I/O pages to low memory can be a bottleneck if the page number is high. How does modern hypervisor solution cope with this issue?
