<script lang="ts">
  import Layout from './components/main/layout.svelte';
  import { Kernel } from './kernel/kernel';
  import { lastMessageFromServer } from './services/network';

  lastMessageFromServer.subscribe(value => {
   new Kernel().parse(value);
  });
</script>

<main>
    <Layout />
</main>

<style>
</style>
