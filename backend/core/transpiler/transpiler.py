def transpile(backend, qc):
    
    job = backend.run(
        qc,
        dry_run=True,
        job_settings={"compilation": {"service_version": "v0.4"}}
    )

    job.wait_for_final_state()

    return job.compiled_circuit(lang="native")