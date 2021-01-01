---
layout: post
title: "Start Linux Kernel Hacking"
last_modified_at: 20 Sep, 2020
categories: "2020"
description: "This is a summary of how to compile and boot the Linux kernel on the KVM-qemu virtual machine. It coveres how to get a VM running in KVM, how to build a customized kernel, and how to use GDB with the Linux kernel. The experiment is conducted on an amd64 architecture CPU. We use Ubuntu as our testing environment but the steps covered here should apply to other distros as well."
tags: os linux kernel
comments: true
---

<p align="center"> 
<a href="https://www.redandblack.com/opinion/opinion-make-the-switch-to-a-linux-operating-system/article_0b8bb324-5425-11e9-9d96-ab61c820e566.html">
<img src="https://raw.githubusercontent.com/BDHU/Page_pics/master/posts/linux_kernel_hacking/linux.jpg" width="80%">
</a>
</p>

This is a summary of how to compile and boot the Linux kernel on the KVM-qemu virtual machine. It coveres how to get a VM running in KVM, how to build a customized kernel, and how to use GDB with the Linux kernel. The experiment is conducted on an amd64 architecture CPU. We use Ubuntu as our testing environment but the steps covered here should apply to other distros as well.
<!--description-->

## Getting a VM running in KVM
The Ubuntu ISO image is downloaded from the [Canonical website](https://ubuntu.com/download/desktop). The kernel is downloaded directly from [kernel.org](https://www.kernel.org/). The specs of our test environment is:

* CPU: Intel(R) Core(TM) i7-6800K CPU @ 3.40GHz
* RAM: 32 GB
* Host and Guest OS: Ubuntu 20.04.1 LTS
* Host Kernel Version: 5.4.0-47-generic
* GCC: 7.5.0
* QEMU emulator version: 4.2.0
* Guest Kernel Version: 5.8.6

After we obtained the Ubuntu ISO image, we use GUI virt-manager to install the OS. One thing to notice here is the default directory for virtual disks is ```/var/lib/libvirt/images```, since my system partition is located on a seperate SSD with limited space, the virtual disk directory is changed to my ```/home``` directory instead.

We also create the new virtual disk inside virt-manager. We chose raw format instead of qcow2. Creating a new image file can also be done in command line using:
```shell
qemu-img create -f raw -o preallocation=full vmdisk.img 40G
```

The preallocation can be turn either on or off depends on personal choices. After the disk image is created, we proceeds in virt-manager to install Ubuntu on the newly allocated virtual disk. We enabled storage for this virtual machine so that we don't need to repeat the installation process everytime we launch the VM. One thing to be noticed here is we don't need swap area inside a virtual machine. We can simply use the whole virtual disk for ```/``` partition.

To start the VM from cmd, you might need to change the owner of the disk image. We add the user to both ```kvm``` and ```libvirt```. The image created or accessed by virt-manager seems to change the file owner to libvirt-qemu, which may cause problems when starting from cmd.

After the installation is finished, we can simply launch the virtual machine inside virt-manager through its GUI interface. We can also use command line to start the VM:
```shell
kvm -accel kvm -m 8G -smp 6 --snapshot -drive format=raw,file=/home/ed/virtimg/ubuntu20.04
```

The argument ```-accel kvm``` enables Kernel-based Virtual Machine full virtualization, which uses hardware acceleration. Without this option the VM will become extremely slow. The ```-m 8G``` assigns the given amount of memory to the VM. The ```-smp 6``` assigns the given number of cores to the guest if the host has multiple cores. The ```--snapshot``` ensures that no changes are made to your image during an execution so you can do something dangerous and have the original image file preserved. The ```-drive``` option specifies the location of the virtual disk and its format. We will use some of these options later.

To confirm the VM has internet access, simply execution ```apt install pkg-name``` in the guest terminal. No error message would indicates properlu functioning network access from the guest VM. For example, when we execute ```sudo apt install llvm``` it shows:

```
Reading package lists... Done
Building dependency tree       
Reading state information... Done
The following additional packages will be installed:
  llvm-runtime
The following NEW packages will be installed:
  llvm llvm-runtime
0 upgraded, 2 newly installed, 0 to remove and 0 not upgraded.
Need to get 6,796 B of archives.
After this operation, 128 kB of additional disk space will be used.
Do you want to continue? [Y/n] 
```

## Building the Kernel
We can use out customized kernel for our newly created VM. After we obtain the Linux kernel from [kernel.org](https://www.kernel.org/), we extract teh source into \<kernel dir\> and create a separate build directory \<kbuild\> (outside \<kernel dir\>).

Then we enter the \<kbuild\> directory, run

```shell
yes "" | make -C /home/ed/Desktop/linux_kernel/kbuild O=$(pwd) config
```

This will create a ```.config``` file inside \<kbuild\> with the default options selected. We then open the configuration file and ensures ```CONFIG_SATA_AHCI=y```, which builds the SATA disk driver into the kernel. That will allow your kernel to boot off a (virtual) SATA drive without having to load a module to do it.

Next we build the kernel by running ```make``` in \<kbuild\>. We use the -j 6 option speedup the building process using multiple processor cores. This process can take a long time.

## Build and Install Kernel Modules
To build modules locally on host, we create another seperate \<install_mod_dir\> directory for building kernel modules. Then in \<kbuild\>, execute

```
make INSTALL_MOD_PATH=/home/ed/Desktop/linux_kernel/install_mod_dir modules_install 
```

Now there is a ```lib``` directory inside ```/home/ed/Desktop/linux_kernel/install_mod_dir```, which holds all the kernel modules we are about to install.

The complete list of modules can be listed using ```cat modules.builtin``` inside ```lib/moduels/5.8.6```. Here is a [link](https://gist.github.com/BDHU/4d31d18ad106a13caceac4a961d04a44) to all the modules being built. We didn't modify anything in the configuration.

Then we use guestmount to mount the virtual disk to a mount point on the host

```
guestmount -a /home/ed/virtimg/ubuntu20.04 -i ~/vm/linux/
```
In Ubuntu this step yields the following message:

```
libguestfs: error: /usr/bin/supermin exited with error status 1.
To see full error messages you may need to enable debugging.
Do:
  export LIBGUESTFS_DEBUG=1 LIBGUESTFS_TRACE=1
and run the command again.  For further information, read:
  http://libguestfs.org/guestfs-faq.1.html#debugging-libguestfs
You can also run 'libguestfs-test-tool' and post the *complete* output
into a bug report or message to the libguestfs mailing list.
```

The underlying problem is that the kernel cannot be read and according to the [post](https://askubuntu.com/questions/1046828/how-to-run-libguestfs-tools-tools-such-as-virt-make-fs-without-sudo) and the [bug report](https://bugs.launchpad.net/fuel/+bug/1467579) on Ubuntu Launchpad.

To fix the issue, we need to run

```
sudo chmod +r /boot/vmlinuz-*
```

We can verify the contents inside ~/vm/linux by simply cd into it.

To install the modules we just built, we can copy the ```<install_mod_dir>lib/modules``` into the mounted filesystem ```<mount_point>/lib/modules```.

Finally, we unmount the filesystem by doing

```
fusermount -u /mnt/hdd1/vm/linux
```

## Booting KVM with new Kernel
To boot up the VM with the new kernel, we will add a few extra command line options to kvm. For convenience, we put the scritps into a file. It's also available on [gist](https://gist.github.com/BDHU/8c6ab518ab37571a1cae132d79ac9a9e):

```shell
#!/bin/bash

kvm \
    -s \
    -display gtk \
    -cpu host \
    -vga qxl \
    -accel kvm \
    -kernel "/home/ed/Desktop/linux_kernel/kbuild/arch/x86/boot/bzImage" \
    -append "root=/dev/sda1 console=ttyS0,115200n8 nokaslr" \
    -drive format=raw,file=/home/ed/virtimg/ubuntu20.04 \
    -m 8G \
    -smp 6 \
    --snapshot \
    -S
```

Aside from the command line arguments we discussed before, there are a few new members here. the ```-s``` switch is a shorthand for ```-gdb tcp::1234```. The ```-display gtk``` is optional. It enables the opengl context in the display device for gtk display output. ```-cpu host``` says the guest should emulate the host processor. ```-vga qxl```  enables 3D acceleration on the guest system. ```-vga virtio``` also offers good performance in our case. ```-kernel``` allows bootloader to pickup the new kernel. The ```-append``` along with its arguments specifies where the root partition of the hard disk is and the console parameter adds a serial console at boot so you can see boot messages. The ```--snapshot``` in QEMU says the images that refer to an original image will use Redirect-on-Write to avoid changing the original image. The ```-S``` means the kernel won't start executing unless we attach a debugger to it. We only use it later in the debugging stage.

Again, we can verify there is internet access using the new kernel using ```apt update```. There are no errors shown, which indicates the network is functioning correctly.

## Booting Process
Now we are able to boot up the VM successfully, we can first measure how much time the kernel spends in booting. Running ```dmesg -d``` shows the timestamp and time delta spent between messages. The final line shows ```[10.842998]```. If we use ```systemd-analyze```, it outputs

```
Startup finished in 795ms (kernel) + 5.451s (userspace) = 6.247s
graphical.target reached after 5.439s in userspace
```

The reason why there is a gap between these two measurement is because ```dmesg``` is not a reliable test of how long a boot-up process goes. ```dmesg``` itself merely collects information. The drivers and other system processes can output messages at any point in time. There may or may not be processes spawning between those messages.

Next, we are going to look at how PCI device is involved in kernel startup. ```lspci``` outputs the follow

```
00:00.0 Host bridge: Intel Corporation 440FX - 82441FX PMC [Natoma] (rev 02)
00:01.0 ISA bridge: Intel Corporation 82371SB PIIX3 ISA [Natoma/Triton II]
00:01.1 IDE interface: Intel Corporation 82371SB PIIX3 IDE [Natoma/Triton II]
00:01.3 Bridge: Intel Corporation 82371AB/EB/MB PIIX4 ACPI (rev 03)
00:02.0 VGA compatible controller: Red Hat, Inc. Virtio GPU (rev 01)
00:03.0 Ethernet controller: Intel Corporation 82540EM Gigabit Ethernet Controller (rev 03)
```

We can use the PCI address here to search for corresponding information in ```dmesg```. For example, if we use the domain value \\(0000:\\) as query, we get something like:

```
[    0.295026] PCI host bridge to bus 0000:00
[    0.299055] pci 0000:00:00.0: [8086:1237] type 00 class 0x060000
[    0.300133] pci 0000:00:01.0: [8086:7000] type 00 class 0x060100
[    0.301163] pci 0000:00:01.1: [8086:7010] type 00 class 0x010180
[    0.311006] pci 0000:00:02.0: [1af4:1050] type 00 class 0x030000
[    0.319650] pci 0000:00:03.0: [8086:100e] type 00 class 0x020000
```

The full result is also available as [gist](https://gist.github.com/BDHU/4d31d18ad106a13caceac4a961d04a44#file-dmesg_output).

The ```lspci``` command specifies the type of device right after the address. For example, the first one is host bridge. We specifically selected the message in the *type 00 class* format here. The significance here is that the class value actually telss us the type of the corresponding device. We can check the [include/linux/pci_ids.h](https://github.com/torvalds/linux/blob/master/include/linux/pci_ids.h) for each macro respectively. For example,

```c
#define PCI_CLASS_NETWORK_ETHERNET	0x0200
```

this line shows the value 0x0200 cooresponds to a network PCI device. This aligns with our ```dmesg``` output as well as the ```lspci``` result.

## Debugging Kernel
To build KVM+GDB-friendly kernel, we need to have proper CONFIG_DEBUG* options set in the .config file. More specifically, we need to have the following options enabled:

  *  CONFIG_DEBUG_INFO y: compile the kernel with debug info. The full list of definitions can be found [here](https://cateee.net/lkddb/web-lkddb/DEBUG_INFO.html).
  *  CONFIG_DEBUG_INFO_DWARF4 y: generate dwarf4 debug info. Definition can be found [here](https://cateee.net/lkddb/web-lkddb/DEBUG_INFO_DWARF4.html).
  *  CONFIG_GDB_SCRIPTS y: creates the required links to GDB helper scripts in the build directory. Full definition can be found [here](https://cateee.net/lkddb/web-lkddb/GDB_SCRIPTS.html).
  *  CONFIG_GDB_INFO_REDUCED n: disble reduced gdb info.
  *  CONFIG_KGDB y: kernel debugging location. Full list of definitions found [here](https://cateee.net/lkddb/web-lkddb/KGDB.html).
  *  CONFIG_FRAME_POINTER y: compile the kernel with frame pointers. Full list of definitions found [here](https://cateee.net/lkddb/web-lkddb/FRAME_POINTER.html).
  *  CONFIG_SATA_AHCI y: this option enables support for AHCI Serial ATA. Definition found [here](https://cateee.net/lkddb/web-lkddb/SATA_AHCI.html).
  *  CONFIG_KVM_GUEST y: this option enables various optimizations for running under the KVM hypervisor. Definition found [here](https://cateee.net/lkddb/web-lkddb/KVM_GUEST.html).
  *  CONFIG_RANDOMIZE_BASE n: drop support for Kernel Address Space Layout Randomization (KASLR). Definition found [here](https://cateee.net/lkddb/web-lkddb/RANDOMIZE_BASE.html). We also added ```nokaslr``` in our qemu arguments.
  *  CONFIG_SMP y: enable Symmetric multi-processing support. Definition found [here](https://cateee.net/lkddb/web-lkddb/SMP.html).

Now we can recompile the kernel and attack gdb to it. We simply add ```-S``` option to kvm to only start the VM when gdb is attached. Then we enter our \<kbuild\> directory and execute:

```shell
gdb vmlinux
(gdb) target remote:1234
```

The step is also documented in the kernel community [documentation](https://www.kernel.org/doc/html/latest/dev-tools/gdb-kernel-debugging.html).

## Set Breakpoints
Spin lock is easy to find in a kernel. Therefore, we will set break points on ```spin_lock```. For kernel 5.8.6, we see that ```spin_lock``` is defined in [https://elixir.bootlin.com/linux/v5.8.6/source/include/linux/spinlock.h#L351](https://elixir.bootlin.com/linux/v5.8.6/source/include/linux/spinlock.h#L351) as a inline function. If we trace the function, we can see the actual function we should use is ```_raw_spin_lock``` defined [here](https://elixir.bootlin.com/linux/v5.8.6/source/kernel/locking/spinlock.c#L149):

```c
#ifndef CONFIG_INLINE_SPIN_LOCK
void __lockfunc _raw_spin_lock(raw_spinlock_t *lock)
{
	__raw_spin_lock(lock);
}
```

If we need to break the execution only when a given program is executed, we can use the program PID to as the condition. The problem is, how do we get the program PID if it doesn't last for long?

We could instead first set a breakpoint on ```fork```. We can break its kernel call at ```_do_fork``` which is defined [here](https://elixir.bootlin.com/linux/v5.8.6/source/kernel/fork.c#L2416). After that, we can simply continue executing the kernel until we run the program.

> Note: we need to compile the program and open a new terminal first. Since they both involves forking new processes, which will hit ```_do_fork``` before our program runs.

Then we print the process PID using ```p $lx_current().pid```, we then use this value as the condition for ```b _raw_spin_lock if $lx_current().pid == pid_value``` inside gdb.

If we want ```_raw_spin_lock``` to break under different contexts, we can simply use PID as different contexts. We can also set break points in functions in different contexts that calls ```spin_lock``` and see what they do. For example, we can set break point at ```expand_downwards``` defined in [here](https://elixir.bootlin.com/linux/v5.8.6/source/mm/mmap.c#L2428), if we back trace this function, we will get a series of calls, we mention the important ones here

```
#1  0xffffffff81284c4e in expand_stack
#3 0xffffffff813843db in load_elf_binary
#8  do_execve
#12 0xffffffff81b1f658 in do_syscall_64
```
We also added a helper script in .gdbinit to print our the name of the function, which is ''anacron'' in this case.
In short, this process execute commands periodically, and it performs a sys call which loads elf binary, thus requiring stack expansion.

Another example is timer interrupt. The ```get_next_timer_interrupt``` calls ```_raw_spin_lock```. We select some messages from backtrace:

```
#1  0xffffffff8113b224 in get_next_timer_interrupt
#2  0xffffffff8114d52e in tick_nohz_next_event
#4  tick_nohz_idle_stop_tick ()
#5  0xffffffff810df567 in cpuidle_idle_call ()
```

In short, the is a timer interrupt that gets called when CPU is idle.

The last example is ```hrtimer_interrupt```. The selected messages are:

```
#4  0xffffffff8114d80c in tick_sched_timer
#7  0xffffffff8113c8e7 in hrtimer_interrupt
#12 run_on_irqstack_cond
#14 0xffffffff81c00cc2 in asm_sysvec_apic_timer_interrupt
```

In summary, ```hrtimer_interrupt``` is aclled as event handler. This function is responsible to select all timers that have expired and either move them to the expiration list (if they may be processed in softIRQ context) or call the handler function directly.

<!-- ## Extra credit
If we are to set conditional breakpoint of spin_lock which does not stop within the timer interrupt. We can use the gdb [convenience functions](https://sourceware.org/gdb/current/onlinedocs/gdb/Convenience-Funs.html#Convenience-Funs) ```$_any_caller_is(name[, number_of_frames]) == 0```. We can trace the timer interrupt call that uses the ```_raw_spin_lock``` and make sure it doens't break whenever the caller represents an interrupt. For example, we will instead get

```
#3  0xffffffff813130b7 in vfs_poll
#5  do_poll
#9  __x64_sys_poll
#10 0xffffffff81b1f658 in do_syscall_64
```

which represents file system operations. -->

## Syscall
Essentially, processor switches from the user mode to kernel mode and starts exectuion of the sys call entry - ```entry_SYSCALL_64```, we can find its definiction at [here](https://elixir.bootlin.com/linux/v5.8.6/source/arch/x86/entry/entry_64.S#L94). This is the only entry point used for 64-bit system calls. We can set a break point here. When the break point is hit, we use ```info registers``` in gdb to get the value of cr3. In our case, it is 0x22a6d5806. Then we simply step from this breakpoint, and will likely reach ```SWITCH_TO_KERNEL_CR3 scratch_reg=%rsp```. After this call the value in cr3 is changed to 0x22a6d4006. The macro is defined [here](https://elixir.bootlin.com/linux/v5.8.6/source/arch/x86/entry/entry_32.S#L165).

We can see whenver the processor switch from the user mode to kernel mode the value of cr3 is changed. The root cause the Page [Table Isolation (PTI)](https://www.kernel.org/doc/html/latest/x86/pti.html). It is a countermeasure against attacks on the shared user/kernel address space such as the ''Meltdown'' approach. To mitigate this class of attacks, two independent page table copies are created, one in kernel space, one in user space. The cr3 register enables the processor to translate linear addresses into physical addresses by locating the page directory and page tables for the current task. So whenever the process enters kernel mode, the kernel copy requires its page directory address to be loaded into cr3 register.

If we add ```nopti``` in ```-append``` in the QEMU cmd argument and perform the same steps. We get 0x231466005 before and after ```SWITCH_TO_KERNEL_CR3 scratch_reg=%rsp``` is executed. Based on the desciption in the [linux kernel tree](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/tree/Documentation/admin-guide/kernel-parameters.txt?h=v5.1.3#L3656), the ```nopti``` on X86_64 is equivalent to pti=off, therefore explaining the constant value of cr3.

<!-- ## random vs urandom
On the high level. /dev/random blocks because it uses entropy pool, where random data may not be available at the moment. /dev/urandom returns as many bytes as user requested and may be less random. Whether urandom is less desirable is arguable. More discussions can be found [here](https://www.2uo.de/myths-about-urandom/). -->