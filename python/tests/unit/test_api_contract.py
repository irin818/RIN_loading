from rin.api_contract import run_api_contract_check


def test_api_contract_check_passes_on_synthetic_temp_data() -> None:
    report = run_api_contract_check()

    assert report.status == "passed"
    assert report.localState is True
    assert report.conversationPost is True
    assert report.conversationHistory is True
    assert report.readiness is True
    assert report.memoryContextTrace is True
    assert report.profileSummary is True
    assert report.structuredErrors is True
    assert report.providerCallCount == 0
    assert report.externalProviderCallCount == 0
    assert report.uiChangesRequired is False
